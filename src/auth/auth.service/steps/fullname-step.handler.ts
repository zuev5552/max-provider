import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { IdMaxService } from '../idmax.service';
import { SessionManagerService } from '../session.manager.service';
import { MESSAGES } from '../utils/messages.constants';
import { SmsSenderUtil } from '../utils/sms-sender.util';
import { safeReply } from '@/utils/safe-reply.util';

/**
 * Обработчик шага ввода полного имени (ФИО) включается только если на один телефон находит несколько сотрудников.
 *
 * Отвечает за:
 * - поиск сотрудника по введённому ФИО;
 * - проверку, не зарегистрирован ли сотрудник уже;
 * - отправку SMS‑кода подтверждения;
 * - обновление сессии с данными о найденном сотруднике и переходом на этап ожидания кода;
 * - обработку ошибок на каждом этапе с отправкой соответствующих сообщений пользователю.
 *
 * @Injectable
 * @class FullnameStepHandler
 */
@Injectable()
export class FullnameStepHandler {
  private readonly logger = new Logger(FullnameStepHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly idMaxService: IdMaxService,
    private readonly smsSender: SmsSenderUtil,
  ) {}

    /**
   * Обрабатывает ввод полного имени (ФИО) пользователем.
   * Выполняет следующие шаги:
   * 1. Нормализует введённое ФИО (приводит к нижнему регистру).
   * 2. Получает сессию пользователя по `chatId`.
   * 3. Ищет сотрудника в списке возможных кандидатов (`session.possibleStaff`)
   *    по точному совпадению ФИО (без учёта регистра).
   * 4. Если сотрудник не найден, отправляет сообщение `MESSAGES.FULLNAME_NOT_FOUND`.
   * 5. Проверяет, зарегистрирован ли сотрудник уже (`hasIdMax`).
   * 6. Если зарегистрирован, отправляет сообщение о регистрации, удаляет сессию.
   * 7. Если не зарегистрирован, отправляет SMS‑код на номер из сессии.
   * 8. При успешной отправке:
   *    - обновляет сессию: сохраняет ФИО, данные сотрудника, меняет этап на `awaiting_code`;
   *    - отправляет сообщение об отправке SMS.
   * 9. При ошибке отправки SMS:
   *    - отправляет сообщение `MESSAGES.SMS_SEND_ERROR`;
   *    - удаляет сессию для предотвращения дальнейших действий.
   *
   * @param {Context} ctx — контекст сообщения, содержащий данные о чате и пользователе
   * @param {number} chatId — идентификатор чата/пользователя
   * @param {string} inputText — текст сообщения от пользователя (введённое ФИО)
   *
   * @returns {Promise<void>} — асинхронное выполнение без возвращаемого значения
   */
  async handle(ctx: Context, chatId: number, inputText: string): Promise<void> {
    const fullname = inputText.toLowerCase();
    const session = this.sessionManager.get(chatId);

    if (!session) {
      return; // сессия исчезла — выходим
    }

    const matchedStaff = session.possibleStaff?.find(
      staff => `${staff.firstName} ${staff.lastName}`.toLowerCase() === fullname,
    );

    if (!matchedStaff) {
      await safeReply(ctx, MESSAGES.FULLNAME_NOT_FOUND, this.logger);
      return;
    }

    const hasIdMax = await this.idMaxService.hasIdMax(matchedStaff.id);
    if (hasIdMax) {
      await safeReply(ctx, MESSAGES.ALREADY_REGISTERED(matchedStaff.firstName, matchedStaff.lastName), this.logger);
      this.sessionManager.delete(chatId);
      this.logger.log(`[already_registered] Номер привязан к staffId ${matchedStaff.id} для chatId: ${chatId}`);
      return;
    }

    const smsSent = await this.smsSender.sendAuthCode(chatId, session.phone!);

    if (smsSent) {
      this.sessionManager.update(chatId, {
        fullname: inputText,
        matchedStaff,
        step: 'awaiting_code',
      });
      await safeReply(ctx, MESSAGES.SMS_SENT(session.phone!), this.logger);
    } else {
      await safeReply(ctx, MESSAGES.SMS_SEND_ERROR, this.logger);
      this.sessionManager.delete(chatId);
    }
  }
}
