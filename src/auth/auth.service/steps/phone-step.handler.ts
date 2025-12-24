import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { IdMaxService } from '../idmax.service';
import { SessionManagerService } from '../session.manager.service';
import { MESSAGES } from '../utils/messages.constants';
import { SmsSenderUtil } from '../utils/sms-sender.util';
import { PhoneValidationService } from '@/utils/phone.validation.service';
import { safeReply } from '@/utils/safe-reply.util';

/**
 * Обработчик шага ввода и валидации телефонного номера в процессе аутентификации.
 *
 * Отвечает за:
 * - проверку формата введённого номера телефона;
 * - поиск сотрудников по номеру телефона;
 * - обработку случаев: номер не найден, сотрудник уже зарегистрирован;
 * - отправку SMS‑кода подтверждения (если найден один сотрудник);
 * - запрос ввода ФИО (если найдено несколько сотрудников);
 * - обновление сессии с данными о возможных сотрудниках или найденном сотруднике;
 * - обработку ошибок на каждом этапе с отправкой соответствующих сообщений пользователю.
 *
 * @Injectable
 * @class PhoneStepHandler
 */
@Injectable()
export class PhoneStepHandler {
  private readonly logger = new Logger(PhoneStepHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneValidator: PhoneValidationService,
    private readonly idMaxService: IdMaxService,
    private readonly smsSender: SmsSenderUtil,
  ) {}

    /**
   * Обрабатывает ввод телефонного номера пользователем.
   * Выполняет следующие шаги:
   * 1. Проверяет формат номера с помощью `phoneValidator.isValidPhone()`.
   * 2. Ищет сотрудников по номеру с помощью `phoneValidator.findStaffByPhone()`.
   * 3. Если номер не найден (`staffList.length === 0`):
   *    - отправляет сообщение `MESSAGES.PHONE_NOT_FOUND`;
   *    - удаляет сессию;
   *    - логирует ошибку.
   * 4. Сохраняет список возможных сотрудников и номер в сессии.
   * 5. Если найден ровно один сотрудник:
   *    - проверяет, зарегистрирован ли он уже (`hasIdMax`);
   *    - если зарегистрирован, отправляет сообщение о регистрации, удаляет сессию;
   *    - если не зарегистрирован, отправляет SMS‑код;
   *    - при успешной отправке: обновляет сессию (`matchedStaff`, `step: 'awaiting_code'`), отправляет сообщение об отправке SMS;
   *    - при ошибке отправки: отправляет сообщение `MESSAGES.SMS_SEND_ERROR`, удаляет сессию.
   * 6. Если найдено несколько сотрудников:
   *    - обновляет сессию, устанавливая этап `awaiting_fullname`;
   *    - формирует список ФИО сотрудников;
   *    - отправляет запрос на ввод ФИО с перечнем вариантов (`MESSAGES.FULLNAME_PROMPT`);
   *    - логирует переход на этап ввода ФИО.
   *
   * @param {Context} ctx — контекст сообщения, содержащий данные о чате и пользователе
   * @param {number} chatId — идентификатор чата/пользователя
   * @param {string} inputText — текст сообщения от пользователя (введённый номер телефона)
   *
   * @returns {Promise<void>} — асинхронное выполнение без возвращаемого значения
   */
  async handle(ctx: Context, chatId: number, inputText: string): Promise<void> {
    if (!this.phoneValidator.isValidPhone(inputText)) {
      await safeReply(ctx, MESSAGES.PHONE, this.logger);
      return;
    }

    const staffList = await this.phoneValidator.findStaffByPhone(inputText);
    console.log(staffList);

    if (staffList.length === 0) {
      await safeReply(ctx, MESSAGES.PHONE_NOT_FOUND, this.logger);
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
        await safeReply(ctx, MESSAGES.ALREADY_REGISTERED(singleStaff.firstName, singleStaff.lastName), this.logger);
        this.sessionManager.delete(chatId);
        this.logger.log(`[already_registered] Номер привязан к staffId ${singleStaff.id} для chatId: ${chatId}`);
        return;
      }

      const smsSent = await this.smsSender.sendAuthCode(chatId, inputText);

      if (smsSent) {
        this.sessionManager.update(chatId, {
          matchedStaff: singleStaff,
          step: 'awaiting_code',
        });
        await safeReply(ctx, MESSAGES.SMS_SENT(inputText), this.logger);
      } else {
        await safeReply(ctx, MESSAGES.SMS_SEND_ERROR, this.logger);
        this.sessionManager.delete(chatId);
      }
    } else {
      this.sessionManager.update(chatId, { step: 'awaiting_fullname' });
      const namesList = staffList.map(s => `${s.firstName} ${s.lastName}`).join(', ');
      await safeReply(ctx, MESSAGES.FULLNAME_PROMPT(namesList), this.logger);
      this.logger.log(`[awaiting_fullname] Запрошено ФИО для chatId: ${chatId}`);
    }
  }
}
