import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';
import { AuthSession } from '../types/auth.session.type';
import { MESSAGES } from '../utils/messages.constants';
import { SessionTimeoutUtil } from '../utils/session-timeout.util';
import { safeReply } from '@/utils/bot/safe-reply.util';

/**
 * Обработчик начала процесса аутентификации пользователя через бота.
 * Отвечает за:
 * - создание сессии аутентификации;
 * - проверку cooldown‑периода между повторными запросами SMS;
 * - отправку запроса подтверждения номера телефона;
 * - настройку таймаута сессии.
 */
@Injectable()
export class AuthStartHandler {
  private readonly logger = new Logger(AuthStartHandler.name);

  /**
   * Время ожидания между повторными попытками отправки SMS (30 минут).
   */
  private readonly SMS_RESEND_COOLDOWN = 30 * 60 * 1000;

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly sessionTimeout: SessionTimeoutUtil,
  ) {}

  /**
   * Регистрирует обработчик события `message_created` для начала процесса аутентификации.
   * При получении сообщения:
   * - проверяет наличие контактной информации;
   * - обрабатывает cooldown, если сессия уже существует;
   * - создаёт новую сессию и сохраняет номер телефона;
   * - запускает таймер таймаута;
   * - отправляет пользователю запрос подтверждения номера с клавиатурой выбора.
   *
   * @param bot Экземпляр бота, для которого настраивается обработчик событий.
   */
  handleAuthStart(bot: Bot): void {
    bot.on('message_created', async (ctx, next) => {
      if (!ctx.contactInfo) return next();

      const existingSession = this.sessionManager.get(ctx.chatId);
      if (existingSession) {
        const cooldownHandled = await this.handleCooldown(ctx, existingSession, ctx.chatId);
        if (cooldownHandled) {
          return;
        }
      }

      this.sessionManager.create(ctx.chatId);
      this.sessionManager.update(ctx.chatId, {
        phone: ctx.contactInfo.tel,
      });

      this.logger.log(`[start] Сессия создана для chatId: ${ctx.chatId}`);

      // таймер запущен
      this.sessionTimeout.setupTimeout(ctx.chatId);

      const contactKeyboard = Keyboard.inlineKeyboard([
        [
          Keyboard.button.callback('Да', 'contactOk', { intent: 'positive' }),
          Keyboard.button.callback('Нет', 'contactEr', { intent: 'negative' }),
        ],
      ]);
      return ctx.reply(`Это твой номер телефона: <b>${ctx.contactInfo.tel}</b>?`, {
        format: 'html',
        attachments: [contactKeyboard],
      });
    });
  }

  /**
   * Проверяет, находится ли пользователь в cooldown‑периоде после предыдущей попытки отправки SMS.
   * Если cooldown активен, отправляет пользователю сообщение с указанием оставшегося времени.
   *
   * @param ctx Контекст текущего сообщения от пользователя.
   * @param session Текущая сессия аутентификации пользователя.
   * @param chatId Идентификатор чата для логирования и обработки.
   *
   * @returns `true`, если cooldown активен и сообщение отправлено;
   *          `false`, если cooldown истёк или отсутствует.
   *
   * @private
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
