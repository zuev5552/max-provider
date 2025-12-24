import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';
import { MESSAGES } from '../utils/messages.constants';
import { SmsSenderUtil } from '../utils/sms-sender.util';
import { safeReply } from '@/utils/safe-reply.util';

@Injectable()
export class ResendCodeHandler {
  private readonly logger = new Logger(ResendCodeHandler.name);

  private readonly RESEND_CODE_SPAM_LIMIT = 5 * 60 * 1000; // 5 минут между запросами
  // Конфигурируемые лимиты
  private readonly SMS_RESEND_COOLDOWN = 30 * 60 * 1000; // 30 минут в мс

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly smsSender: SmsSenderUtil,
  ) {}

  setup(bot: Bot): void {
    bot.command('/resend_code', async (ctx: Context) => this.handleResendCode(ctx));
  }

  private async handleResendCode(ctx: Context): Promise<void> {
    const chatId = ctx.chatId;
    if (chatId == null) {
      await safeReply(ctx, 'Не удалось определить чат. Попробуйте снова.', this.logger);
      return;
    }

    const session = this.sessionManager.get(chatId);
    if (!session) {
      await safeReply(ctx, MESSAGES.SESSION_NOT_FOUND, this.logger);
      return;
    }

    // Проверяем, что находимся на этапе ожидания кода
    if (session.step !== 'awaiting_code') {
      await safeReply(ctx, MESSAGES.STEP_MISMATCH, this.logger);
      return;
    }

    const now = Date.now();

    // Проверка на спам-запросы /resend_code (не чаще 1 раза в 5 минут)
    const lastResendRequestAt = session.lastResendRequestAt ?? 0;
    const timeSinceLastResend = now - lastResendRequestAt;
    if (timeSinceLastResend < this.RESEND_CODE_SPAM_LIMIT) {
      const minutesLeft = Math.ceil((this.RESEND_CODE_SPAM_LIMIT - timeSinceLastResend) / 60000);
      await safeReply(ctx, `Повторить запрос можно не чаще чем раз в ${minutesLeft} мин.`, this.logger);
      this.logger.log(`[resend_spam_limit] chatId: ${chatId}, осталось минут: ${minutesLeft}`);
      return;
    }

    // Проверка cooldown на отправку SMS (не чаще 1 раза в 30 минут)
    const lastSmsSentAt = session.lastSmsSentAt ?? 0;
    const timeSinceLastSms = now - lastSmsSentAt;

    if (timeSinceLastSms < this.SMS_RESEND_COOLDOWN) {
      const minutesLeft = Math.ceil((this.SMS_RESEND_COOLDOWN - timeSinceLastSms) / 60000);
      await safeReply(ctx, MESSAGES.SMS_COOLDOWN(minutesLeft), this.logger);
      this.logger.log(`[resend_cooldown] chatId: ${chatId}, осталось минут: ${minutesLeft}`);
      return;
    }

    // Обновляем время последнего запроса повторной отправки
    this.sessionManager.update(chatId, { lastResendRequestAt: now });

    // Отправляем новый код через утилиту отправки SMS — она автоматически сбросит attemptsCount
    const smsSent = await this.smsSender.sendAuthCode(chatId, session.phone!);

    if (smsSent) {
      await safeReply(ctx, MESSAGES.NEW_SMS_SENT(session.phone!), this.logger);
      this.logger.log(`[resend_code_success] Новый код отправлен для chatId: ${chatId}`);
    } else {
      await safeReply(ctx, MESSAGES.SMS_SEND_ERROR, this.logger);
      this.sessionManager.delete(chatId);
      this.logger.error(`[resend_code_failed] Не удалось отправить SMS для chatId: ${chatId}`);
    }
  }
}
