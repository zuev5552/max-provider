import { Injectable, Logger } from '@nestjs/common';
import { Bot, Context } from '@maxhub/max-bot-api';
import { SessionManagerService } from './session.manager.service';
import { PhoneValidationService } from './phone.validation.service';
import { IdMaxService } from './idmax.service';
import { CodeGeneratorService } from './code.generator.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly SESSION_TIMEOUT = 600_000;

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneValidator: PhoneValidationService,
    private readonly idMaxService: IdMaxService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  // Метод для подключения бота
  setupBot(bot: Bot): void {
    this.setupAuthDialogue(bot);
  }

  setupAuthDialogue(bot: Bot): void {
    bot.action('auth_start', async (ctx: Context) => this.handleAuthStart(ctx, bot));
    bot.command ('auth_start', async (ctx: Context) => this.handleAuthStart(ctx, bot));
    bot.on('message_created', async (ctx: Context, next) => this.handleMessage(ctx, next));
  }

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

      await this.safeReply(ctx, `Код отправлен на ${inputText}. Введите 4 цифры. У вас одна попытка.`);
      this.logger.log(`[awaiting_code] Код сгенерирован для chatId: ${chatId}`);
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

    await this.safeReply(ctx, `Код отправлен на ${phone}. Введите 4 цифры. У вас одна попытка.`);
    this.logger.log(`[awaiting_code] Код сгенерирован для chatId: ${chatId}`);
    this.setupTimeout(chatId);
  }

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

    if (code === session.code) {
      const success = await this.idMaxService.linkIdMax(session.matchedStaff.id, chatId);
      if (success) {
        await this.safeReply(ctx, `Успешно! Номер ${session.phone} зарегистрирован.`);
        this.sessionManager.delete(chatId);
        this.logger.log(`[success] Регистрация завершена для chatId: ${chatId}, staffId: ${session.matchedStaff.id}`);
      } else {
        await this.safeReply(ctx, 'Произошла ошибка при сохранении данных. Попробуйте позже.');
        this.sessionManager.delete(chatId);
      }
    } else {
      await this.safeReply(ctx, 'Неверный код. Регистрация отменена. Начните заново с /auth_start');
      this.sessionManager.delete(chatId);
      this.logger.log(`[failed] Неверный код для chatId: ${chatId}`);
    }
  }

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
