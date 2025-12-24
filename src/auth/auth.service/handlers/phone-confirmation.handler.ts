import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';
import { PhoneStepHandler } from '../steps/phone-step.handler';
import { MESSAGES } from '../utils/messages.constants';
import { safeReply } from '@/utils/safe-reply.util';

/**
 * Обработчик подтверждения телефонного номера в процессе аутентификации.
 *
 * Отвечает за обработку callback‑действий от встроенной клавиатуры:
 * - подтверждение номера телефона (кнопка «Да»);
 * - отклонение номера телефона (кнопка «Нет»).
 *
 * При подтверждении передаёт номер в `PhoneStepHandler` для дальнейшей обработки.
 * При отклонении отправляет пользователю сообщение с просьбой ввести номер вручную.
 *
 * @Injectable
 * @class PhoneConfirmationHandler
 */
@Injectable()
export class PhoneConfirmationHandler {
  private readonly logger = new Logger(PhoneConfirmationHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneStepHandler: PhoneStepHandler,
  ) {}

    /**
   * Настраивает обработчики callback‑действий для бота.
   * Регистрирует асинхронные обработчики для действий:
   * - `contactOk` — пользователь подтвердил номер телефона;
   * - `contactEr` — пользователь отклонил номер телефона.
   *
   * @param {Bot} bot — экземпляр бота MaxBot API, для которого настраиваются обработчики
   *   callback‑действий
   *
   * @example
   * const phoneConfirmationHandler = new PhoneConfirmationHandler(sessionManager, phoneStepHandler);
   * phoneConfirmationHandler.setup(bot); // Регистрирует обработчики действий для бота
   *
   * @returns {void}
   */
  setup(bot: Bot): void {
    bot.action('contactOk', async (ctx: Context) => {
      await this.phoneConfirmation(ctx, true);
    });

    bot.action('contactEr', async (ctx: Context) => {
      await this.phoneConfirmation(ctx, false);
    });
  }

    /**
   * Обрабатывает подтверждение или отклонение номера телефона пользователем.
   * Выполняет следующие шаги:
   * 1. Получает `chatId` из контекста сообщения.
   * 2. Проверяет существование сессии и номера телефона в ней.
   * 3. При подтверждении (`isConfirmed = true`) передаёт номер в `phoneStepHandler.handle()`
   *    для дальнейшей обработки (валидация, поиск сотрудника, отправка SMS).
   * 4. При отклонении (`isConfirmed = false`) отправляет сообщение `MESSAGES.PHONE`
   *    с просьбой ввести номер вручную.
   *
   * @param {Context} ctx — контекст сообщения, содержащий данные о чате и пользователе
   * @param {boolean} isConfirmed — флаг подтверждения номера:
   *   - `true` — пользователь подтвердил номер;
   *   - `false` — пользователь отклонил номер
   *
   * @returns {Promise<void>} — асинхронное выполнение без возвращаемого значения
   * @private
   */
  private async phoneConfirmation(ctx: Context, isConfirmed: boolean): Promise<void> {
    const chatId = ctx.chatId;
    if (!chatId) return;
    const session = this.sessionManager.get(chatId);
    if (!session) return;
    if (!session.phone) return;

    if (isConfirmed) {
      await this.phoneStepHandler.handle(ctx, chatId, session.phone);
    } else {
      await safeReply(ctx, MESSAGES.PHONE, this.logger);
    }
  }
}
