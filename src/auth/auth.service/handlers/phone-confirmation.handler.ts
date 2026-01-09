import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';
import { PhoneAuthFlowHandler } from '../steps/phoneAuthFlow-step.handler';
import { MESSAGES } from '../utils/messages.constants';
import { PhoneValidationService } from '@/utils/validation/phone.validation.service';
import { safeReply } from '@/utils/bot/safe-reply.util';

/**
 * Обработчик подтверждения номера телефона пользователем через интерактивные кнопки.
 * Отвечает за:
 * - обработку действий пользователя («Да»/«Нет» при подтверждении номера);
 * - валидацию подтверждённого номера телефона;
 * - передачу управления обработчику ввода Dodo IS при успешном подтверждении;
 * - отправку запроса на повторный ввод номера при отклонении или ошибке валидации.
 */
@Injectable()
export class PhoneConfirmationHandler {
  private readonly logger = new Logger(PhoneConfirmationHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneAuthFlowHandler: PhoneAuthFlowHandler,
    private readonly phoneValidator: PhoneValidationService,
  ) {}

  /**
   * Регистрирует обработчики действий пользователя для кнопок подтверждения номера телефона:
   * - `contactOk` — пользователь подтвердил номер;
   * - `contactEr` — пользователь отклонил номер.
   * При срабатывании вызывает метод `phoneConfirmation` с соответствующим флагом подтверждения.
   *
   * @param bot Экземпляр бота, для которого настраиваются обработчики действий.
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
   * - проверяет наличие `chatId` и текущей сессии;
   * - убеждается, что в сессии сохранён номер телефона;
   * - при подтверждении (`isConfirmed = true`) и успешной валидации номера
   *   передаёт управление обработчику Dodo IS;
   * - при отклонении (`isConfirmed = false`) или неудачной валидации
   *   отправляет пользователю запрос на повторный ввод номера.
   *
   * @param ctx Контекст текущего действия (содержит информацию о чате и пользователе).
   * @param isConfirmed Флаг подтверждения номера: `true` — номер подтверждён,
   *   `false` — номер отклонён пользователем.
   *
   * @returns `Promise<void>` — асинхронное выполнение без возвращаемого значения.
   *
   * @private
   */
  private async phoneConfirmation(ctx: Context, isConfirmed: boolean): Promise<void> {
    const chatId = ctx.chatId;
    if (!chatId) return;
    const session = this.sessionManager.get(chatId);
    if (!session) return;
    if (!session.phone) return;

    if (isConfirmed && this.phoneValidator.isValidPhone(session.phone)) {
      await this.phoneAuthFlowHandler.handle(ctx, chatId, session.phone);
    } else {
      await safeReply(ctx, MESSAGES.PHONE, this.logger);
    }
  }
}
