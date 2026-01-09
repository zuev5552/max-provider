import { Context } from '@maxhub/max-bot-api';
import { Logger } from '@nestjs/common';

/**
 * Безопасная отправка сообщения пользователю через контекст бота.
 *
 * Обрабатывает возможные ошибки при отправке сообщения:
 * - если основная отправка не удалась, пытается отправить сообщение об ошибке;
 * - записывает ошибки в лог через указанный logger.
 *
 * @param {Context} ctx - контекст сообщения для ответа (предоставляется ботом)
 * @param {string} text - текст отправляемого сообщения
 * @param {Logger} logger - экземпляр логгера для записи ошибок
 * @returns {Promise<void>} - промис, который завершается после попытки отправки
 *
 * @example
 * import { safeReply } from './utils/safe-reply.util';
 *
 * async someHandler(ctx: Context) {
 *   await safeReply(ctx, 'Привет, пользователь!', this.logger);
 * }
 *
 * @description
 * Алгоритм работы:
 * 1. Пытается отправить основное сообщение через `ctx.reply(text)`.
 * 2. Если возникает ошибка:
 *    - логирует её через переданный logger;
 *    - пытается отправить резервное сообщение: «Произошла ошибка. Попробуйте позже.»;
 *    - если и резервная отправка не удалась — логирует вторую ошибку.
 * 3. Не выбрасывает исключений — все ошибки обрабатываются внутри.
 *
 * @throws {Error} - не выбрасывает ошибок (полностью обрабатывает их внутри)
 */
export async function safeReply(ctx: Context, text: string, logger: Logger): Promise<void> {
  try {
    await ctx.reply(text);
  } catch (error) {
    logger.error(`Ошибка отправки сообщения: ${error.message}`);
    try {
      // Попытка отправить сообщение об ошибке
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    } catch (replyError) {
      logger.error(`Не удалось отправить сообщение об ошибке: ${replyError.message}`);
    }
  }
}
