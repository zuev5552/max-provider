// services/low-stock-callback.service.ts
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';
import { LowStockCallbackData } from '../types/low-stock-callback-data.types';

/**
 * Сервис обработки колбэков о низком уровне запасов сырья.
 * Отвечает за:
 * - парсинг payload из колбэка;
 * - обновление статуса задачи в БД;
 * - редактирование сообщения в чате с подтверждением выполнения;
 * - логирование ошибок.
 */
@Injectable()
export class LowStockCallbackService {
  private readonly logger = new Logger(LowStockCallbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Обрабатывает колбэк о низком уровне запасов: обновляет запись в БД и редактирует сообщение в чате.
   *
   * Пошаговая логика:
   * 1. Парсит payload колбэка в объект LowStockCallbackData.
   * 2. Обновляет запись в таблице inventoryLowStock (указывает причину, время решения, имя пользователя).
   * 3. Получает информацию о сырье по itemId.
   * 4. Редактирует сообщение в чате: показывает подтверждение, название сырья, причину и время выполнения.
   * 5. При ошибке — логирует и продолжает выполнение (не выбрасывает исключение).
   *
   * @param {Context} ctx - Контекст сообщения с колбэком (содержит данные о чате, пользователе, колбэке)
   * @param {string} payload - Строка payload из колбэка кнопки (формат: type:createdDateUtc:unitId:itemId:reason)
   * @param {null | string | undefined} userName - Имя пользователя, выполнившего действие (может отсутствовать)
   * @returns {Promise<void>} Асинхронное выполнение без возвращаемого значения
   *
   * @example
   * // payload: "lowStock:2023-10-01T12:00:00Z:123:456:Недостаток на складе"
   * await handleLowStockCallback(ctx, payload, "Иван Иванов");
   */
  async handleLowStockCallback(ctx: Context, payload: string, userName: null | string | undefined): Promise<void> {
    const callbackData = this.parseCallbackPayload(payload);
    try {
      await this.prisma.inventoryLowStock.update({
        where: {
          inventory_lower_stock_unique: {
            createdDateUtc: callbackData.createdDateUtc,
            unitId: callbackData.unitId,
            itemId: callbackData.itemId,
          },
        },
        data: {
          reason: callbackData.reason,
          resolvedAtUtc: new Date(),
          resolvedByUserName: userName ?? 'Неизвестный пользователь',
        },
      });
      const item = await this.prisma.inventoryItem.findFirst({ where: { id: callbackData.itemId } });
      if (!item) return;

      const keyboard = Keyboard.inlineKeyboard([[Keyboard.button.callback(callbackData.reason, callbackData.reason)]]);

      // Редактируем сообщение: оставляем только выбранную кнопку
      await ctx.editMessage({
        text: `✅ Задача выполнена
Проблемное сырье: <b>${item.name}</b>
Выбранная причина: ${callbackData.reason}
Время выполнения задачи: ${new Date().toLocaleString('ru-RU')}\n`,
        format: 'html',
        attachments: [keyboard],
      });
    } catch (error) {
      this.logger.error(`Ошибка в калбеке ${error}`);
    }
  }

  /**
   * Парсит строку payload из колбэка в структурированный объект LowStockCallbackData.
   * Ожидаемый формат payload: "type:createdDateUtc:unitId:itemId:reason".
   *
   * @param {string} payload - Исходная строка payload из колбэка
   * @returns {LowStockCallbackData} Объект с разобранными данными колбэка:
   * - type: тип колбэка (всегда 'lowStock');
   * - createdDateUtc: дата создания задачи в UTC;
   * - unitId: идентификатор подразделения;
   * - itemId: идентификатор сырья;
   * - reason: причина низкого запаса.
   *
   * @example
   * const data = parseCallbackPayload("lowStock:2023-10-01T12:00:00Z:123:456:Недостаток на складе");
   * // Результат:
   * // {
   * //   type: 'lowStock',
   * //   createdDateUtc: '2023-10-01T12:00:00Z',
   * //   unitId: '123',
   * //   itemId: '456',
   * //   reason: 'Недостаток на складе'
   * // }
   */
  private parseCallbackPayload(payload: string): LowStockCallbackData {
    const parts = payload.split(':');
    return {
      type: 'lowStock',
      createdDateUtc: parts[1],
      unitId: parts[2],
      itemId: parts[3],
      reason: parts[4],
    };
  }
}
