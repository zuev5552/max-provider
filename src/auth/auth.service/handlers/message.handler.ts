import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';
import { CodeStepHandler } from '../steps/code-step.handler';
import { FullnameStepHandler } from '../steps/fullname-step.handler';
import { PhoneStepHandler } from '../steps/phone-step.handler';
import { safeReply } from '@/utils/safe-reply.util';

@Injectable()
export class MessageHandler {
  private readonly logger = new Logger(MessageHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneStepHandler: PhoneStepHandler,
    private readonly fullnameStepHandler: FullnameStepHandler,
    private readonly codeStepHandler: CodeStepHandler,
  ) {}

  /**
   * Обрабатывает входящее текстовое сообщение в контексте текущей сессии аутентификации.
   * Выполняет следующие шаги:
   * 1. Получает `chatId` из контекста сообщения.
   * 2. Проверяет существование сессии для данного чата.
   * 3. Извлекает и очищает текст сообщения.
   * 4. В зависимости от этапа сессии (`session.step`):
   *    - передаёт управление соответствующему обработчику шага;
   *    - отправляет сообщение об ошибке и очищает сессию при неизвестном этапе.
   * 5. Обрабатывает ошибки выполнения, отправляет сообщение пользователю и очищает сессию.
   *
   * @param {Context} ctx — контекст сообщения, содержащий данные о чате, пользователе и тексте сообщения
   * @param {() => Promise<void>} next — функция продолжения цепочки middleware,
   *   вызывается, если сообщение не относится к активной сессии аутентификации
   *
   * @returns {Promise<void>} — асинхронное выполнение без возвращаемого значения
   * @private
   */
  setup(bot: Bot): void {
    bot.on('message_created', async (ctx: Context, next) => this.handleMessage(ctx, next));
  }

  private async handleMessage(ctx: Context, next: () => Promise<void>): Promise<void> {
    const chatId = ctx.chatId;
    if (chatId == null) {
      this.logger.log('[message_created] Не найден chatId');
      return await next();
    }

    const session = this.sessionManager.get(chatId);
    if (!session) return await next();
    console.log(session);

    const inputText = ctx.message?.body?.text?.trim();
    if (!inputText) {
      await safeReply(ctx, 'Пожалуйста, введите номер телефона текстом в формате +79991234567', this.logger);
      return;
    }

    try {
      switch (session.step) {
        case 'awaiting_phone':
          await this.phoneStepHandler.handle(ctx, chatId, inputText);
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
