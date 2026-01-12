/* eslint-disable perfectionist/sort-classes */
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionService } from '@/utils/session/session.service';

/**
 * Middleware для блокировки команд и callback‑запросов во время активного диалога.
 * Проверяет разрешения через SessionService и блокирует действия, если они не разрешены
 * для текущего состояния сессии.
 */
@Injectable()
export class DialogBlockerMiddleware {
  private logger = new Logger(DialogBlockerMiddleware.name);
  constructor(private sessionService: SessionService) {}

  /**
   * Основной метод middleware: обрабатывает входящие сообщения и callback‑запросы.
   * Блокирует команды и callback‑payload, если они не разрешены для текущей сессии.
   * @param ctx Контекст сообщения от бота (содержит данные о чате, пользователе, сообщении)
   * @param next Функция для передачи управления следующему middleware/контроллеру
   * @returns Promise<void>
   */
  use = async (ctx: Context, next: () => Promise<void>) => {
    const userId = ctx.user?.user_id;
    if (!userId) return await next();

    // Получаем текущую сессию пользователя
    const session = this.sessionService.get(userId);
    if (!session) return await next(); // Если сессии нет — пропускаем

    const stepDescription = session.stepDescription || 'Завершите текущий этап диалога';

    // 1. Обрабатываем callback‑запросы (нажатия кнопок)
    if (ctx.callback) {
      const payload = ctx.callback.payload;

      if (payload && typeof payload === 'string') {
        // Проверяем, разрешён ли данный callback для текущей сессии
        if (!this.sessionService.isCallbackAllowed(session, payload)) {
          await ctx.reply(
            `⏸️ Сейчас идёт активный диалог. Сначала завершите текущий шаг:\n\n${stepDescription}\n\n` +
              'Используйте `/cancel` для отмены диалога.',
            { format: 'markdown' },
          );
          return; // Прерываем цепочку — действие заблокировано
        }
      }
    }

    // 2. Обрабатываем текстовые команды (начинающиеся с '/')
    const messageText = ctx.message?.body?.text;
    if (messageText && typeof messageText === 'string' && messageText.startsWith('/')) {
      const command = messageText.trim().split(' ')[0];

      // Проверяем, разрешена ли данная команда для текущей сессии
      if (!this.sessionService.isCommandAllowed(session, command)) {
        this.logger.debug(`[DialogBlocker] Блокировка команды ${command} для user_id: ${userId}`);
        await ctx.reply(
          `⏸️ Сейчас идёт активный диалог. Сначала завершите текущий шаг:\n\n${stepDescription}\n\n` +
            'Используйте `/cancel` для отмены диалога или `/help` для справки.',
          { format: 'markdown' },
        );
        return; // Прерываем цепочку — команда заблокирована
      }
    }

    // Если все проверки пройдены, передаём управление дальше
    await next();
  };
}
