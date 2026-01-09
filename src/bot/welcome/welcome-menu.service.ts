// src/bot/services/start.service.ts
import { Keyboard } from '@maxhub/max-bot-api';
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';

/**
 * Сервис обработки команды /start и отображения приветственного меню с кнопками.
 *
 * Отвечает за:
 * - проверку авторизации пользователя в системе;
 * - валидацию статуса сотрудника (уволен/работает);
 * - формирование персонализированного меню в зависимости от типа сотрудника;
 * - отправку приветственного сообщения с клавиатурой.
 *
 * @example
 * ```typescript
 * const welcomeMenuService = new WelcomeMenuService(prismaService);
 * await welcomeMenuService.handleStartCommand(ctx);
 * ```
 */
@Injectable()
export class WelcomeMenuService {
  private readonly logger = new Logger(WelcomeMenuService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Обрабатывает команду /start от пользователя:
   * 1. Извлекает ID пользователя из контекста.
   * 2. Проверяет существование пользователя в системе.
   * 3. Валидирует статус сотрудника (не уволен).
   * 4. Формирует и отправляет персонализированное меню.
   *
   * При ошибках: логирует проблему и отправляет пользователю сообщение об ошибке.
   *
   * @param ctx - Контекст сообщения от бота, содержащий данные о пользователе и чате.
   *   Обязательные поля:
   *   - `user.user_id` или `message.sender.user_id` — ID пользователя.
   *
   * @returns {Promise<void>} — Promise, разрешающийся после отправки меню или обработки ошибки.
   *
   * @throws {Error} — Ошибки, связанные с БД или отправкой сообщений, логируются внутри метода.
   *   Пользователь получает обобщённое сообщение об ошибке.
   *
   * @example
   * ```typescript
   * await welcomeMenuService.handleStartCommand(ctx);
   * ```
   */
  async handleStartCommand(ctx: Context): Promise<void> {
    const userId = ctx.user?.user_id || ctx.message?.sender?.user_id;
    if (!userId) {
      this.logger.warn('Ошибка с userId');
      return;
    }

    try {
      const userBigIntId = BigInt(userId);
      const staff = await this.prisma.staffMax.findFirst({
        where: { idMax: userBigIntId },
        include: { staff: true },
      });
      if (!staff || !staff.staff) return;

      const status = staff.staff?.status;
      const staffType = staff.staff?.staffType;

      // Проверка статуса сотрудника
      if (status === 'Dismissed') {
        this.logger.debug(`Доступ запрещён: сотрудник ${userId} уволен (статус: Dismissed)`);
        await ctx.reply('Ваш статус в системе — уволен. Доступ ограничен');
        return;
      }

      // Формирование клавиатуры в зависимости от типа сотрудника
      const mainMenuKeyboard = this.createWelcomeMenu(staffType);

      await ctx.reply('Выберите нужный вам сервис', {
        attachments: [mainMenuKeyboard],
      });
      this.logger.debug('Команда /start обработана успешно для пользователя ID: ' + userId);
    } catch (error) {
      this.logger.error(`Ошибка при обработке команды /start для пользователя ${userId}:`, error);

      try {
        await ctx.reply('Произошла ошибка при загрузке меню. Попробуйте позже.');
      } catch (replyError) {
        this.logger.error('Не удалось отправить сообщение об ошибке пользователю:', replyError);
      }
    }
  }

  /**
   * Формирует клавиатуру с кнопками в зависимости от типа сотрудника.
   *
   * @param staffType - Тип сотрудника (`'Courier'`, `'Cashier'`, `'KitchenMember'`).
   *   Для других значений или `undefined` возвращается минимальное меню.
   * @returns {Keyboard} — Объект клавиатуры для отправки в мессенджере.
   * @private
   *
   * @example createWelcomeMenu('Courier') // 1 кнопка: «Сервис для курьера»
   * @example createWelcomeMenu('Cashier') // 3 кнопки: курьер, линейный сотрудник, контроль остатков
   * @example createWelcomeMenu() // минимальное меню (1 кнопка)
   */
  private createWelcomeMenu(staffType?: string) {
    if (staffType === 'Courier') {
      return Keyboard.inlineKeyboard([[Keyboard.button.callback('Сервис для курьера', 'service_courier')]]);
    } else if (staffType === 'Cashier' || staffType === 'KitchenMember') {
      return Keyboard.inlineKeyboard([
        [Keyboard.button.callback('Сервис для курьера', 'service_courier')],
        [Keyboard.button.callback('Сервис для линейного сотрудника', 'service_employee')],
        [Keyboard.button.callback('Сервис по программе контроля остатков сырья', 'service_stock_control')],
      ]);
    } else {
      return Keyboard.inlineKeyboard([[Keyboard.button.callback('Сервис для курьера', 'service_courier')]]);
    }
  }
}
