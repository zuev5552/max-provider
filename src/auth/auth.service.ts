import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context } from '@maxhub/max-bot-api';
import { SessionManagerService } from './session.manager.service';
import { PhoneValidationService } from './phone.validation.service';
import { IdMaxService } from './idmax.service';
import { CodeGeneratorService } from './code.generator.service';
import { SMSRu } from 'node-sms-ru';

import { env } from '../config/env';

/**
 * Сервис аутентификации пользователей через мессенджер.
 *
 * Реализует многоэтапный процесс авторизации:
 * - запуск диалога аутентификации;
 * - ввод и валидация номера телефона;
 * - сопоставление с данными сотрудников;
 * - отправка и проверка кода подтверждения;
 * - привязка идентификатора пользователя мессенджера к учётной записи.
 *
 * Включает механизм таймаута сессий и обработку ошибок.
 *
 * @Injectable
 * @class AuthService
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  /**
   * Время жизни сессии аутентификации (в мс), задаётся из переменных окружения.
   * @private
   * @readonly
   * @type {number}
   */
  private readonly SESSION_TIMEOUT = env.SESSION_TIMEOUT;

  /**
   * Конструктор сервиса.
   *
   * @param {SessionManagerService} sessionManager - сервис управления сессиями аутентификации
   * @param {PhoneValidationService} phoneValidator - сервис валидации телефонных номеров
   * @param {IdMaxService} idMaxService - сервис работы с идентификаторами пользователей
   * @param {CodeGeneratorService} codeGenerator - сервис генерации кодов подтверждения
   * @param {SMSRu} smsRu - сервис для отправки SMS через сервис SMS.ru
   */
  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneValidator: PhoneValidationService,
    private readonly idMaxService: IdMaxService,
    private readonly codeGenerator: CodeGeneratorService,
    private readonly smsRu: SMSRu,
  ) {}

  /**
   * Подключает бота к системе аутентификации.
   *
   * @param {Bot} bot - экземпляр бота для интеграции с системой аутентификации
   * @returns {void}
   */
  setupBot(bot: Bot): void {
    this.setupAuthDialogue(bot);
  }

  /**
   * Настраивает обработчики событий бота для диалога аутентификации.
   *
   * Регистрирует:
   * - действие по кнопке 'auth_start';
   * - команду '/auth_start';
   * - обработчик входящих сообщений.
   *
   * @param {Bot} bot - экземпляр бота, для которого настраивается диалог
   * @returns {void}
   */
  setupAuthDialogue(bot: Bot): void {
    bot.action('auth_start', async (ctx: Context) => this.handleAuthStart(ctx, bot));
    bot.command('auth_start', async (ctx: Context) => this.handleAuthStart(ctx, bot));

    bot.on('message_created', async (ctx: Context, next) => this.handleMessage(ctx, next));
  }

  /**
   * Обрабатывает начало процесса аутентификации.
   *
   * Создаёт новую сессию, запрашивает ввод телефона и устанавливает таймаут.
   *
   * @param {Context} ctx - контекст сообщения от пользователя
   * @param {Bot} bot - экземпляр бота
   * @returns {Promise<void>}
   * @private
   */
  private async handleAuthStart(ctx: Context, bot: Bot): Promise<void> {
    const chatId = ctx.chatId;
    if (chatId == null) {
      await this.safeReply(ctx, 'Не удалось определить чат. Попробуйте снова.');
      return;
    }

    this.sessionManager.create(chatId);
    await this.safeReply(ctx, 'Для регистрации в системе введите ваш телефон в формате +79991234567');
    this.logger.log(`[start] Сессия создана для chatId: ${chatId}`);
    this.setupTimeout(chatId);
  }

  /**
   * Основной обработчик входящих сообщений в процессе аутентификации.
   *
   * Определяет текущий этап сессии пользователя и направляет обработку соответствующему методу
   * в зависимости от стадии аутентификации (ввод телефона, ФИО или кода подтверждения).
   *
   * @param {Context} ctx - контекст текущего сообщения (содержит данные о чате, отправителе и содержимом)
   * @param {() => Promise<void>} next - функция передачи управления следующему middleware
   *   в случае отсутствия активной сессии или других условий продолжения цепочки обработки
   * @returns {Promise<void>} - асинхронное выполнение без возвращаемого значения
   * @private
   *
   * @description
   * Логика работы метода:
   * 1. Проверяет наличие chatId в контексте сообщения.
   * 2. Получает текущую сессию пользователя по chatId.
   * 3. Извлекает и очищает текст сообщения от пользователя.
   * 4. Если текст отсутствует — запрашивает ввод номера телефона.
   * 5. В зависимости от текущего этапа сессии (`session.step`):
   *    - `awaiting_phone` → вызывает `handlePhoneStep`
   *    - `awaiting_fullname` → вызывает `handleFullnameStep`
   *    - `awaiting_code` → вызывает `handleCodeStep`
   *    - иное значение → сообщает об ошибке состояния и удаляет сессию
   * 6. При возникновении ошибок:
   *    - логирует ошибку;
   *    - уведомляет пользователя о проблеме;
   *    - удаляет сессию.
   *
   * @example
   * // Пример вызова при получении сообщения от пользователя
   * await this.handleMessage(ctx, next);
   *
   * @throws {Error} - обрабатывает любые ошибки, возникающие в процессе обработки,
   *   логируя их и уведомляя пользователя
   */
  private async handleMessage(ctx: Context, next: () => Promise<void>): Promise<void> {
    const chatId = ctx.chatId;
    if (chatId == null) {
      this.logger.log('[message_created] Не найден chatId');
      return next();
    }

    const session = this.sessionManager.get(chatId);
    if (!session) return next();

    const inputText = ctx.message?.body?.text?.trim();
    if (!inputText) {
      await this.safeReply(ctx, 'Пожалуйста, введите номер телефона текстом в формате +79991234567');
      return;
    }

    try {
      switch (session.step) {
        case 'awaiting_phone':
          await this.handlePhoneStep(ctx, chatId, inputText);
          break;
        case 'awaiting_fullname':
          await this.handleFullnameStep(ctx, chatId, inputText);
          break;
        case 'awaiting_code':
          await this.handleCodeStep(ctx, chatId, inputText);
          break;
        default:
          this.logger.warn(`Неизвестная стадия сессии для chatId ${chatId}: ${session.step}`);
          await this.safeReply(ctx, 'Произошла ошибка состояния. Начните заново с /auth_start');
          this.sessionManager.delete(chatId);
      }
    } catch (error) {
      this.logger.error(`Ошибка обработки сообщения: ${error.message}`);
      await this.safeReply(ctx, 'Произошла ошибка, попробуйте позже');
      this.sessionManager.delete(chatId);
    }
  }

  /**
   * Обрабатывает ввод номера телефона.
   *
   * Проверяет формат, ищет сотрудников, отправляет код подтверждения или запрашивает ФИО (если дубли телефона).
   *
   * @param {Context} ctx - контекст сообщения
   * @param {number} chatId - идентификатор чата
   * @param {string} inputText - введённый текст
   * @returns {Promise<void>}
   * @private
   */
  private async handlePhoneStep(ctx: Context, chatId: number, inputText: string): Promise<void> {
    if (!this.phoneValidator.isValidPhone(inputText)) {
      await this.safeReply(ctx, 'Введите номер в формате +79991234567');
      return;
    }

    const staffList = await this.phoneValidator.findStaffByPhone(inputText.replace('+', ''));

    if (staffList.length === 0) {
      await this.safeReply(ctx, 'Такого телефона нет в базе. Обратитесь к управляющему.');
      this.sessionManager.delete(chatId);
      this.logger.log(`[phone_not_found] Телефон ${inputText} не найден для chatId: ${chatId}`);
      return;
    }

    this.sessionManager.update(chatId, {
      possibleStaff: staffList,
      phone: inputText,
    });

    if (staffList.length === 1) {
      const singleStaff = staffList[0];
      const hasIdMax = await this.idMaxService.hasIdMax(singleStaff.id);

      if (hasIdMax) {
        await this.safeReply(
          ctx,
          `Этот номер уже привязан к учётной записи ${singleStaff.firstName} ${singleStaff.lastName}.`,
        );
        this.sessionManager.delete(chatId);
        this.logger.log(`[already_registered] Номер привязан к staffId ${singleStaff.id} для chatId: ${chatId}`);
        return;
      }

      this.sessionManager.update(chatId, {
        matchedStaff: singleStaff,
        step: 'awaiting_code',
        code: this.codeGenerator.generateCode(),
      });

      const session = this.sessionManager.get(chatId);
      try {
        const smsResult = await this.smsRu.sendSms({
          to: inputText, // корректный номер телефона
          msg: `код авторизации на сайте Dodo-sky ${String(session?.code)}`,
          // TODO на проде отключить тест а то не пойдут смс
          test: true,
        });

        if (smsResult.status === 'OK') {
          await this.safeReply(ctx, `Код отправлен на ${inputText}. Введите 4 цифры. У вас одна попытка.`);
          this.logger.log(`[sms_sent] Код ${String(session?.code)} отправлен на ${inputText} для chatId: ${chatId}`);
        } else {
          await this.safeReply(ctx, `Не удалось отправить смс на номер  ${inputText}. Попробуйте позже.`);
          this.logger.error(`Не удалось отправить смс на номер  ${inputText}`);
        }
      } catch (error) {
        this.logger.error(`Не удалось отправить SMS: ${error.message}`);
        await this.safeReply(ctx, 'Не удалось отправить код подтверждения. Попробуйте позже.');
        this.sessionManager.delete(chatId);
      }
    } else {
      this.sessionManager.update(chatId, { step: 'awaiting_fullname' });
      const namesList = staffList.map(s => `${s.firstName} ${s.lastName}`).join(', ');
      await this.safeReply(
        ctx,
        `Найден(ы) сотрудник(ы): ${namesList}.\nУкажите ваше полное имя (ФИО) точно как в системе.`,
      );
      this.logger.log(`[awaiting_fullname] Запрошено ФИО для chatId: ${chatId}`);
    }

    this.setupTimeout(chatId);
  }

  /**
   * Обрабатывает ввод полного имени (ФИО) - только если дубли телефонов. Если дублей нет то метод не работает.
   *
   * Сопоставляет введённое имя с найденными сотрудниками, генерирует код подтверждения.
   *
   * @param {Context} ctx - контекст сообщения
   * @param {number} chatId - идентификатор чата
   * @param {string} inputText - введённое полное имя
   * @returns {Promise<void>}
   * @private
   */
  private async handleFullnameStep(ctx: Context, chatId: number, inputText: string): Promise<void> {
    const fullname = inputText.toLowerCase();
    const session = this.sessionManager.get(chatId);

    if (!session) {
      return; // сессия исчезла — выходим
    }

    const matchedStaff = session.possibleStaff?.find(
      staff => `${staff.firstName} ${staff.lastName}`.toLowerCase() === fullname,
    );

    if (!matchedStaff) {
      await this.safeReply(
        ctx,
        'Имя не найдено среди сотрудников с этим телефоном. Проверьте написание и попробуйте снова.',
      );
      return;
    }

    const hasIdMax = await this.idMaxService.hasIdMax(matchedStaff.id);
    if (hasIdMax) {
      await this.safeReply(
        ctx,
        `Этот номер уже привязан к учётной записи ${matchedStaff.firstName} ${matchedStaff.lastName}.`,
      );
      this.sessionManager.delete(chatId);
      this.logger.log(`[already_registered] Номер привязан к staffId ${matchedStaff.id} для chatId: ${chatId}`);
      return;
    }

    this.sessionManager.update(chatId, {
      fullname: inputText,
      matchedStaff,
      step: 'awaiting_code',
      code: this.codeGenerator.generateCode(),
    });

    const phone = session.phone;
    if (!phone) {
      await this.safeReply(ctx, 'Произошла ошибка: не найден телефон. Начните заново.');
      this.sessionManager.delete(chatId);
      return;
    }

    await this.safeReply(ctx, `Код отправлен на ${phone}. Введите 4 цифры`);
    this.logger.log(`[awaiting_code] Код сгенерирован для chatId: ${chatId}`);
    this.setupTimeout(chatId);
  }

  /**
   * Обрабатывает ввод кода подтверждения в процессе аутентификации.
   *
   * Выполняет следующие действия:
   * - проверяет существование сессии;
   * - валидирует формат введённого кода;
   * - преобразует строку в числовое значение;
   * - проверяет наличие сопоставленного сотрудника в сессии;
   * - увеличивает счётчик попыток ввода;
   * - сверяет введённый код с ожидаемым значением;
   * - при успешном совпадении привязывает идентификатор пользователя к учётной записи;
   * - при ошибке ограничивает число попыток (максимум 10);
   * - отправляет соответствующие уведомления пользователю на каждом этапе.
   *
   * @param {Context} ctx - контекст текущего сообщения от пользователя (содержит информацию о чате и отправителе)
   * @param {number} chatId - уникальный идентификатор чата, в котором происходит аутентификация
   * @param {string} inputText - текст, введённый пользователем (предполагаемый код подтверждения)
   * @returns {Promise<void>} - асинхронное выполнение без возвращаемого значения
   * @private
   *
   * @example
   * // Пример вызова метода при получении сообщения с кодом
   * await this.handleCodeStep(ctx, 12345, '1234');
   *
   * @description
   * Логика работы:
   * 1. Если сессия отсутствует — игнорирует запрос.
   * 2. Если код не соответствует формату (не 4 цифры) — просит ввести корректный код.
   * 3. Если не найден сопоставленный сотрудник — сообщает об ошибке и удаляет сессию.
   * 4. При совпадении кода с ожидаемым:
   *    - привязывает ID пользователя к учётной записи;
   *    - отправляет сообщение об успешном завершении;
   *    - удаляет сессию.
   * 5. При несовпадении кода:
   *    - увеличивает счётчик попыток;
   *    - если попыток > 10 — отменяет регистрацию;
   *    - иначе — сообщает о неверном коде и оставшихся попытках.
   */
  private async handleCodeStep(ctx: Context, chatId: number, inputText: string): Promise<void> {
    const session = this.sessionManager.get(chatId);
    if (!session) {
      return; // сессия уже удалена — игнорируем
    }

    if (!this.codeGenerator.isValidCodeInput(inputText)) {
      await this.safeReply(ctx, 'Введите 4 цифры кода');
      return;
    }

    const code = parseInt(inputText, 10);
    if (isNaN(code)) {
      await this.safeReply(ctx, 'Ошибка обработки кода');
      return;
    }

    if (!session.matchedStaff) {
      await this.safeReply(ctx, 'Произошла ошибка: не найден сотрудник. Начните заново.');
      this.sessionManager.delete(chatId);
      this.logger.error(`[handleCodeStep] matchedStaff отсутствует для chatId: ${chatId}`);
      return;
    }
    // Увеличиваем счётчик попыток
    const attemptsCount = (session.attemptsCount ?? 0) + 1;
    const userId = ctx.message?.sender?.user_id;

    if (userId && code === session.code) {
      const success = await this.idMaxService.linkIdMax(session.matchedStaff.id, userId);
      if (success) {
        await this.safeReply(ctx, `Успешно! Номер ${session.phone} зарегистрирован.`);
        this.sessionManager.delete(chatId);
        this.logger.log(`[success] Регистрация завершена для chatId: ${chatId}, staffId: ${session.matchedStaff.id}`);
      } else {
        await this.safeReply(ctx, 'Произошла ошибка при сохранении данных. Попробуйте позже.');
        this.sessionManager.delete(chatId);
      }
    } else {
      this.sessionManager.update(chatId, { attemptsCount });
      this.setupTimeout(chatId);
      if (attemptsCount >= 10) {
        await this.safeReply(ctx, 'Вы использовали все 10 попыток. Регистрация отменена. Начните заново с /auth_start');
        this.sessionManager.delete(chatId);
        this.logger.log(`[failed] Исчерпаны попытки для chatId: ${chatId}`);
      } else {
        const remaining = 10 - attemptsCount;
        await this.safeReply(ctx, `Неверный код. Осталось попыток: ${remaining}. Введите 4 цифры.`);
        this.logger.log(`[attempt_failed] Неверный код для chatId: ${chatId}, попыток использовано: ${attemptsCount}`);
      }
    }
  }

  /**
   * Устанавливает таймер автоудаления сессии по истечении времени.
   *
   * - отменяет предыдущий таймер, если он существует;
   * - создаёт новый таймер на основе SESSION_TIMEOUT;
   * - сохраняет ID таймера в сессии для возможности отмены.
   *
   * @param {number} chatId - идентификатор чата, для которого устанавливается таймер
   * @returns {void}
   * @private
   */
  private setupTimeout(chatId: number): void {
    // Очищаем предыдущий таймер, если он есть
    const existingSession = this.sessionManager.get(chatId);
    if (existingSession?.timeoutId) {
      clearTimeout(existingSession.timeoutId); // исправлено: было timeoutDialogue
    }

    const timeoutId = setTimeout(() => {
      if (this.sessionManager.get(chatId)) {
        this.sessionManager.delete(chatId);
        this.logger.log(`Сессия ${chatId} удалена по таймауту`);
      }
    }, this.SESSION_TIMEOUT);

    // Сохраняем ID таймера в сессии для возможности отмены
    this.sessionManager.update(chatId, { timeoutId });
  }

  /**
   * Безопасная отправка сообщения пользователю.
   *
   * Обрабатывает возможные ошибки при отправке сообщения:
   * - если основная отправка не удалась, пытается отправить сообщение об ошибке;
   * - записывает ошибки в лог.
   *
   * @param {Context} ctx - контекст сообщения для ответа
   * @param {string} text - текст отправляемого сообщения
   * @returns {Promise<void>}
   * @private
   */
  private async safeReply(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.reply(text);
    } catch (error) {
      this.logger.error(`Ошибка отправки сообщения: ${error.message}`);
      try {
        // Попытка отправить сообщение об ошибке
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
      } catch (replyError) {
        this.logger.error(`Не удалось отправить сообщение об ошибке: ${replyError.message}`);
      }
    }
  }
}
