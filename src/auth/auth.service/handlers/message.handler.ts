import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';
import { CodeStepHandler } from '../steps/code-step.handler';
import { PhoneAuthFlowHandler } from '../steps/phoneAuthFlow-step.handler';
import { FullnameStepHandler } from '../steps/fullname-step.handler';
import { MESSAGES } from '../utils/messages.constants';
import { PhoneValidationService } from '@/utils/phone.validation.service';
import { safeReply } from '@/utils/safe-reply.util';

/**
 * Обработчик входящих сообщений от пользователей в процессе аутентификации.
 * Отвечает за:
 * - получение и валидацию входных данных;
 * - маршрутизацию сообщений к соответствующим обработчикам шагов аутентификации
 * (Dodo IS, полное имя, код подтверждения);
 * - обработку ошибок и неизвестных состояний сессии;
 * - отправку соответствующих сообщений пользователю.
 */
@Injectable()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneAuthFlowHandler: PhoneAuthFlowHandler,
    private readonly fullnameStepHandler: FullnameStepHandler,
    private readonly codeStepHandler: CodeStepHandler,
    private readonly phoneValidator: PhoneValidationService,
  ) {}

  setup(bot: Bot): void {
    bot.on('message_created', async (ctx: Context, next) => this.handleMessage(ctx, next));
  }

  /**
   * Обрабатывает входящее сообщение от пользователя в контексте текущей сессии аутентификации.
   * Выполняет следующие шаги:
   * - проверяет наличие `chatId`;
   * - получает текущую сессию пользователя;
   * - извлекает и валидирует текст сообщения;
   * - валидирует номер телефона, если сессия находится на шаге `awaiting_phone`;
   * - маршрутизирует сообщение к соответствующему обработчику шага аутентификации;
   * - обрабатывает ошибки и неизвестные состояния сессии.
   *
   * @param ctx Контекст текущего сообщения (содержит информацию о чате, пользователе и тексте сообщения).
   * @param next Функция для передачи управления следующему middleware в цепочке.
   *
   * @returns `Promise<void>` — асинхронное выполнение без возвращаемого значения.
   *
   * @private
   */
  private async handleMessage(ctx: Context, next: () => Promise<void>): Promise<void> {
    const chatId = ctx.chatId;
    if (chatId == null) {
      this.logger.log('[message_created] Не найден chatId');
      return await next();
    }

    const session = this.sessionManager.get(chatId);
    if (!session) return await next();

    const inputText = ctx.message?.body?.text?.trim();
    if (!inputText) {
      await safeReply(ctx, MESSAGES.PHONE, this.logger);
      return;
    }

    if (session.step === 'awaiting_phone' && !this.phoneValidator.isValidPhone(inputText)) {
      await safeReply(ctx, MESSAGES.PHONE, this.logger);
      return;
    }

    try {
      switch (session.step) {
        case 'awaiting_phone':
          await this.phoneAuthFlowHandler.handle(ctx, chatId, inputText);
          break;
        case 'awaiting_fullname':
          await this.fullnameStepHandler.handle(ctx, chatId, inputText);
          break;
        case 'awaiting_code':
          await this.codeStepHandler.handle(ctx, chatId, inputText);
          break;
        default:
          this.logger.warn(`Неизвестная стадия сессии для chatId ${chatId}: ${session.step}`);
          await safeReply(ctx, 'Произошла ошибка состояния. Начните заново с /auth_start', this.logger);
          this.sessionManager.delete(chatId);
      }
    } catch (error) {
      this.logger.error(`Ошибка обработки сообщения: ${error.message}`);
      await safeReply(ctx, 'Произошла ошибка, попробуйте позже', this.logger);
      this.sessionManager.delete(chatId);
    }
  }
}
