import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { IdMaxService } from '../idmax.service';
import { SessionManagerService } from '../session.manager.service';
import { MESSAGES } from '../utils/messages.constants';
import { SmsSenderUtil } from '../utils/sms-sender.util';
import { PhoneValidationService } from '@/utils/phone.validation.service';
import { safeReply } from '@/utils/safe-reply.util';

/**
 * Обработчик потока аутентификации пользователя по номеру телефона.
 * Координирует многоэтапный процесс идентификации:
 * - поиск сотрудников по номеру телефона;
 * - проверка наличия учётной записи IdMax у найденного сотрудника;
 * - отправка SMS‑кода подтверждения при однозначном совпадении;
 * - запрос полного имени для уточнения при нескольких совпадениях;
 * - управление состоянием сессии аутентификации.
 *
 * Поддерживает три сценария:
 * 1. Номер не найден → сообщение об ошибке, завершение сессии.
 * 2. Один сотрудник, есть IdMax → сообщение о регистрации, завершение сессии.
 * 3. Один сотрудник, нет IdMax → отправка SMS, переход к шагу ввода кода.
 * 4. Несколько сотрудников → запрос ФИО, переход к шагу уточнения.
 */
@Injectable()
export class PhoneAuthFlowHandler {
  private readonly logger = new Logger(PhoneAuthFlowHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneValidator: PhoneValidationService,
    private readonly idMaxService: IdMaxService,
    private readonly smsSender: SmsSenderUtil,
  ) {}

  /**
   * Обрабатывает шаг аутентификации пользователя по номеру телефона. Выполняет:
   * - поиск сотрудников, привязанных к указанному номеру;
   * - проверку наличия хотя бы одного совпадения;
   * - при одном сотруднике: проверку IdMax и отправку SMS‑кода (если нет IdMax);
   * - при нескольких сотрудниках: запрос полного имени для уточнения;
   * - обновление состояния сессии в зависимости от результата.
   *
   * @param ctx Контекст текущего сообщения (содержит информацию о чате и пользователе).
   * @param chatId Идентификатор чата, в котором происходит аутентификация.
   *   Используется для привязки сессии и отправки ответов.
   * @param phone Номер телефона, введённый пользователем или полученный из контакта.
   *   Ожидается в формате, поддерживаемом сервисом валидации.
   *
   * @returns `Promise<void>` — асинхронное выполнение без возвращаемого значения.
   *
   * @example
   * ```typescript
   * await phoneAuthFlowHandler.handle(ctx, 12345, '+79991234567');
   * ```
   *
   * @throws Не бросает исключений — все ошибки обрабатываются внутри метода
   *   с отправкой соответствующих сообщений пользователю.
   */
  async handle(ctx: Context, chatId: number, phone: string): Promise<void> {
    const staffList = await this.phoneValidator.findStaffByPhone(phone);

    if (staffList.length === 0) {
      await safeReply(ctx, MESSAGES.PHONE_NOT_FOUND, this.logger);
      this.sessionManager.delete(chatId);
      this.logger.log(`[phone_not_found] Телефон ${phone} не найден для chatId: ${chatId}`);
      return;
    }

    this.sessionManager.update(chatId, {
      possibleStaff: staffList,
      phone: phone,
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

      const smsSent = await this.smsSender.sendAuthCode(chatId, phone);

      if (smsSent) {
        this.sessionManager.update(chatId, {
          matchedStaff: singleStaff,
          step: 'awaiting_code',
        });
        await safeReply(ctx, MESSAGES.SMS_SENT(phone), this.logger);
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
