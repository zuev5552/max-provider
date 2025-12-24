import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';
import { AuthSession } from '../types/auth.session.type';
import { MESSAGES } from '../utils/messages.constants';
import { SessionTimeoutUtil } from '../utils/session-timeout.util';
import { safeReply } from '@/utils/safe-reply.util';

@Injectable()
export class AuthStartHandler {
  private readonly logger = new Logger(AuthStartHandler.name);

  // Константа для cooldown (30 минут в мс)
  private readonly SMS_RESEND_COOLDOWN = 30 * 60 * 1000;

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly sessionTimeout: SessionTimeoutUtil,
  ) {}

  setup(bot: Bot): void {
    bot.action('auth_start', async (ctx: Context) => this.handleAuthStart(ctx));
  }

  private async handleAuthStart(ctx: Context): Promise<void> {
    const chatId = ctx.chatId;
    if (chatId == null) {
      await safeReply(ctx, 'Не удалось определить чат. Попробуйте снова.', this.logger);
      return;
    }

    const existingSession = this.sessionManager.get(chatId);
    if (existingSession) {
      const cooldownHandled = await this.handleCooldown(ctx, existingSession, chatId);
      if (cooldownHandled) {
        return;
      }
    }

    // Создаём новую сессию (без дополнительных параметров)
    this.sessionManager.create(chatId);

    await safeReply(ctx, MESSAGES.AUTH_START_INSTRUCTIONS, this.logger);

    // await ctx.reply('Показать телефон', {
    //   attachments: [Keyboard.inlineKeyboard([[Keyboard.button.requestContact('контакт')]])],
    // });

    this.logger.log(`[start] Сессия создана для chatId: ${chatId}`);

    // Устанавливаем таймаут для сессии
    this.sessionTimeout.setupTimeout(chatId);
  }

  /**
   * Обрабатывает ситуацию, когда сессия уже существует и проверяет cooldown
   * @returns true, если cooldown активен и отправлено сообщение пользователю
   */
  private async handleCooldown(ctx: Context, session: AuthSession, chatId: number): Promise<boolean> {
    const now = Date.now();
    const lastSmsSentAt = session.lastSmsSentAt ?? 0;
    const timeSinceLastSms = now - lastSmsSentAt;

    if (timeSinceLastSms < this.SMS_RESEND_COOLDOWN) {
      const minutesLeft = Math.ceil((this.SMS_RESEND_COOLDOWN - timeSinceLastSms) / 60000);
      await safeReply(ctx, MESSAGES.AUTH_START_COOLDOWN(minutesLeft), this.logger);
      this.logger.log(`[auth_start_cooldown] chatId: ${chatId}, осталось минут: ${minutesLeft}`);
      return true;
    }

    return false;
  }
}
