import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';
import { AuthSession } from '../types/auth.session.type';
import { MESSAGES } from '../utils/messages.constants';
import { SessionTimeoutUtil } from '../utils/session-timeout.util';
import { safeReply } from '@/utils/safe-reply.util';

/**
 * Обработчик запуска процесса аутентификации через контактный номер телефона.
 *
 * Отвечает за:
 * - обработку входящих сообщений с контактными данными;
 * - создание и обновление сессии аутентификации;
 * - проверку cooldown между запросами SMS;
 * - отправку запроса подтверждения номера телефона с клавиатурой выбора;
 * - запуск таймера сессии.
 *
 * @Injectable
 * @class AuthStartHandler
 */
@Injectable()
export class AuthStartHandler {
  private readonly logger = new Logger(AuthStartHandler.name);

   /**
   * Время ожидания между повторными запросами SMS.
   * Установлено в 30 минут .
   * @private
   * @constant {number}
   */
  private readonly SMS_RESEND_COOLDOWN = 30 * 60 * 1000;

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly sessionTimeout: SessionTimeoutUtil,
  ) {}

    /**
   * Настраивает обработчик для события `message_created` бота.
   * Обрабатывает сообщения, содержащие контактные данные пользователя:
   * - проверяет наличие существующей сессии;
   * - обрабатывает cooldown между запросами SMS;
   * - создаёт новую сессию, если её нет;
   * - сохраняет номер телефона из контакта в сессию;
   * - запускает таймер сессии;
   * - отправляет пользователю запрос на подтверждение номера с клавиатурой выбора.
   *
   * @param {Bot} bot — экземпляр бота MaxBot API для регистрации обработчика событий
   *
   * @example
   * const authStartHandler = new AuthStartHandler(sessionManager, sessionTimeout);
   * authStartHandler.handleAuthStart(bot); // Регистрирует обработчик сообщений для бота
   *
   * @returns {void}
   */
  handleAuthStart(bot: Bot): void {
    bot.on('message_created', async (ctx, next) => {
      if (!ctx.contactInfo) return next();
      console.log(ctx);

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
   * Обрабатывает ситуацию, когда сессия уже существует, и проверяет cooldown между запросами SMS.
   *
   * Если время с последнего запроса SMS меньше  30 минут’, отправляет пользователю
   * сообщение с указанием оставшегося времени ожидания.
   *
   * @param {Context} ctx — контекст сообщения для отправки ответа пользователю
   * @param {AuthSession} session — существующая сессия аутентификации
   * @param {number} chatId — идентификатор чата/пользователя
   * @returns {Promise<boolean>} `true`, если cooldown активен и сообщение отправлено; `false` в противном случае
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
