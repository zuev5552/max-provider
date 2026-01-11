// src/bot/middleware/auth.middleware.ts
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';


type NextFunction = () => Promise<void>;

/**
 * Middleware для проверки авторизации пользователя перед обработкой сообщений.
 *
 * Проверяет:
 * - наличие userId в контексте;
 * - существование пользователя в базе данных;
 * - статус сотрудника (Active/Suspended).
 *
 * При успешной проверке передаёт управление дальше по цепочке middleware.
 * При ошибке отправляет пользователю сообщение с предложением авторизоваться.
 *
 * @Injectable
 * @class AuthMiddleware
 */
@Injectable()
export class AuthMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Основной метод middleware — проверяет авторизацию и управляет потоком выполнения.
   *
   * @async
   * @param {Context} ctx - контекст сообщения бота
   * @param {NextFunction} next - функция передачи управления следующему middleware
   * @returns {Promise<void>}
   */
  async use(ctx: Context, next: NextFunction): Promise<void> {
    console.dir(ctx, { depf: null });
    console.dir(ctx.message?.body, { depf: null });
    console.dir(ctx.message?.recipient, { depf: null });
    // console.dir(ctx.message?.body.attachments, { depf: null });

    // 1. Безопасное получение userId
    const userId = ctx.message?.sender?.user_id;
    if (!userId || ctx.updateType != 'message_created') {
      return await next();
    }

    try {
      // 2. Проверка авторизации с учётом статуса сотрудника
      const authorizedRecord = await this.prisma.staffMax.findUnique({
        where: { idMax: userId },
        include: {
          staff: {
            select: { status: true },
          },
        },
      });

      const isAuthorized =
        authorizedRecord !== null &&
        authorizedRecord.staff !== null &&
        ['Active', 'Suspended'].includes(authorizedRecord.staff.status);

      // 3. Обработка неавторизованного пользователя
      if (!isAuthorized) {
        await ctx.reply('Сервис доступен только для авторизованных пользователей', {
          attachments: [Keyboard.inlineKeyboard([[Keyboard.button.requestContact('Авторизация')]])],
        });
        return; // Прерываем цепочку
      }

      // 4. Для авторизованных — передаём управление дальше
      await next();
    } catch (error) {
      this.logger.error(`Ошибка при проверке авторизации пользователя ${userId}: ${error.message}`, error);

      // В случае ошибки тоже не даём доступ к функционалу
      await ctx.reply('Произошла ошибка при проверке авторизации. Попробуйте позже.', {
        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('Авторизация', 'auth_start')]])],
      });
    }
  }
}
