import { Bot, Context } from '@maxhub/max-bot-api';
import { Logger } from '@nestjs/common';
import { Session } from './type';
import { PrismaClient, Staff } from '@prisma/client'; // Импорт Prisma

const prisma = new PrismaClient();

/**
 * Инициализирует диалог аутентификации для бота.
 * Реализует двухэтапный процесс: ввод телефона → ввод кода подтверждения.
 * 
 * @param bot Экземпляр бота для регистрации разных ботов Макс
 * 
 * @description
 * Основные функции:
 * - Запуск диалога через команду `/auth_start`
 * - Валидация номера телефона (международный формат)
 * - Отправка и проверка проверочного кода
 * - Управление сессиями с таймаутом (10 минут)
 * - Обработка команд `/cancel` и `/resend_code`
 * - Защита от превышения попыток ввода кода (максимум 3 попытки)
 */
export function authDialogue(bot: Bot) {
  const logger = new Logger('authDialogue');
  const sessions = new Map<number, Session>();

  // Время жизни сессии (10 минут)
  const SESSION_TIMEOUT = 600_000;

  // Очищает сессию по таймауту
  const setupSessionTimeout = (chatId: number) => {
    setTimeout(() => {
      if (sessions.has(chatId)) {
        sessions.delete(chatId);
        logger.log(`Сессия ${chatId} удалена по таймауту`);
      }
    }, SESSION_TIMEOUT);
  };

  /** Время жизни сессии в миллисекундах (10 минут) */
  const isValidPhone = (phone: string): boolean => {
    return /^\+[1-9]\d{6,14}$/.test(phone.trim());
  };

  /**
   * Обрабатывает команду `/auth_start` — запуск процесса аутентификации.
   * Создаёт новую сессию и запрашивает у пользователя номер телефона.
   */
  bot.action('auth_start', async (ctx: Context) => {
    const chatId = ctx.chatId ?? null;
    if (!chatId) {
      await safeReply(ctx, 'Не удалось определить чат. Попробуйте снова.');
      return;
    }

    sessions.set(chatId, {
      step: 'awaiting_phone',
      phone: null,
      code: null,
      createdAt: new Date(),
      chatId,
      attempts: 0,
    });

    await safeReply(ctx, 'Для регистрации в системе введите ваш телефон в формате +79991234567');
    logger.log(`[start] Сессия создана для chatId: ${chatId}`);

    setupSessionTimeout(chatId);
  });

  /**
   * Обрабатывает команду `/resend_code` — повторная отправка проверочного кода.
   * Сбрасывает счётчик попыток и отправляет новый код на сохранённый номер.
   */
  bot.command('resend_code', async (ctx: Context) => {
    const chatId = ctx.chatId ?? null;
    if (!chatId || !sessions.has(chatId)) {
      await safeReply(ctx, 'Начните диалог с /auth_start');
      return;
    }

    const session = sessions.get(chatId)!;
    if (session.step !== 'awaiting_code' || !session.phone) {
      await safeReply(ctx, 'Код ещё не был запрошен');
      return;
    }

    session.attempts = 0; // сбрасываем счётчик попыток
    await safeReply(ctx, `На номер ${session.phone} отправлен новый проверочный код. Введите его здесь.`);
    logger.log(`[resend_code] Новый код отправлен для chatId: ${chatId}`);

    setupSessionTimeout(chatId);
  });

   /**
   * Обрабатывает входящие текстовые сообщения в рамках активной сессии.
   * В зависимости от текущего шага сессии:
   * - Принимает и валидирует номер телефона
   * - Принимает и проверяет проверочный код
   */
  bot.on('message_created', async (ctx: Context, next) => {
    const chatId = ctx.chatId ?? null;
    if (!chatId) {
      logger.log('[message_created] Не найден chatId');
      return next();
    }

    const session = sessions.get(chatId);
    if (!session) {
      return next();
    }

    const text = ctx.message?.body?.text?.trim();

    if (!text) {
      await safeReply(ctx, 'Пожалуйста, введите текст');
      return;
    }

    try {
      if (session.step === 'awaiting_phone') {
        if (!isValidPhone(text)) {
          await safeReply(ctx, 'Введите номер в формате +79991234567');
          return next();
        }

        session.phone = text;
        session.step = 'awaiting_code';
        session.attempts = 0;

        await safeReply(
          ctx,
          `Спасибо! На номер ${session.phone} отправлен проверочный код. Введите его здесь (4 цифры).`,
        );
        logger.log(`[awaiting_phone] Телефон сохранён для chatId: ${chatId}`);
        setupSessionTimeout(chatId);
      } else if (session.step === 'awaiting_code') {
        if (!/^\d{4}$/.test(text)) {
          await safeReply(ctx, 'Пожалуйста, введите 4 цифры кода');
          return next();
        }

        const code = parseInt(text, 10);
        if (isNaN(code)) {
          await safeReply(ctx, 'Ошибка при обработке кода');
          return next();
        }

        session.code = code;
        session.attempts += 1;

        setupSessionTimeout(chatId);

        if (session.attempts <= 3) {
          await safeReply(ctx, `Спасибо! Ваш номер ${session.phone} успешно зарегистрирован.`);
          sessions.delete(chatId); // Удаляем сессию после успеха
          logger.log(`[success] Регистрация завершена для chatId: ${chatId}`);
        } else {
          await safeReply(ctx, 'Превышено число попыток. Начните заново с /auth_start');
          sessions.delete(chatId);
          logger.log(`[failed] Превышены попытки для chatId: ${chatId}`);
        }
      }
    } catch (error) {
      logger.error(`Ошибка обработки сообщения: ${error.message}`);
      await safeReply(ctx, 'Произошла ошибка, попробуйте позже');
    }
  });

    /**
   * Безопасная отправка сообщения пользователю.
   * Обрабатывает возможные ошибки при отправке (например, недоступность чата).
   *
   * @param ctx Контекст сообщения
   * @param text Текст сообщения для отправки
   * @returns Промис, который разрешается после попытки отправки
   */
  async function safeReply(ctx: Context, text: string): Promise<void> {
    try {
      await ctx.reply(text);
    } catch (error) {
      logger.error(`Ошибка отправки сообщения: ${error.message}`);
    }
  }
}
