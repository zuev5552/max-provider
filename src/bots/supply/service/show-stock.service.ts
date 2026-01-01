/* eslint-disable perfectionist/sort-classes */
// services/low-stock-callback.service.ts
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';
import { StockData } from '../types/stock-data.types';
import { convertMeasurementUnit } from '@/utils/convert-measurement-unit';
import { formatDays } from '@/utils/format-days';

/**
 * Сервис для отображения информации об остатках сырья в боте.
 * Отвечает за:
 * - получение данных об остатках из БД по наименованию сырья;
 * - форматирование данных (единицы измерения, даты, количество дней);
 * - отправку отформатированного сообщения в бот;
 * - обработку ошибок и крайних случаев.
 */
@Injectable()
export class ShowStockService {
  private readonly logger = new Logger(ShowStockService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Основной метод для отображения остатков сырья по команде бота.
   *
   * Пошаговая логика:
   * 1. Определяет наименование сырья по команде пользователя.
   * 2. Проверяет наличие данных о сырье и идентификатора пользователя.
   * 3. Передаёт управление в renderStockToBot для получения и форматирования данных.
   *
   * @param {Context} ctx - Контекст сообщения от бота (содержит данные о чате, пользователе, команде)
   * @returns {Promise<void>} Асинхронное выполнение без возвращаемого значения
   *
   * @example
   * // Пользователь отправляет команду /testo20
   * await showStockService(ctx);
   */
  async showStockService(ctx: Context): Promise<void> {
    const nameItem = ctx.botInfo?.commands!.find(el => el.name === ctx.match?.[0])?.description;
    if (!nameItem) {
      await ctx.reply('Не удалось определить запрашиваемое сырьё.', { format: 'html' });
      return;
    }
    const userId = ctx.message?.sender?.user_id;
    if (!userId) {
      await ctx.reply('Не удалось определить пользователя.', { format: 'html' });
      return;
    }

    await this.renderStockToBot(ctx, nameItem, userId);
  }

  /**
   * Форматирует и отправляет данные об остатках сырья в бот.
   *
   * Пошаговая логика:
   * 1. Выполняет SQL‑запрос к БД для получения данных по указанному сырью и пользователю.
   * 2. Если данных нет — отправляет сообщение об отсутствии данных.
   * 3. Форматирует дату расчёта остатков в локальном часовом поясе.
   * 4. Формирует текстовое сообщение с остатками по всем подразделениям.
   * 5. Применяет утилиты для конвертации единиц измерения и форматирования дней.
   * 6. Отправляет отформатированное сообщение в чат.
   * 7. При ошибке — логирует и отправляет сообщение об ошибке.
   *
   * @param {Context} ctx - Контекст сообщения (для отправки ответа в чат)
   * @param {string} nameItem - Наименование сырья для поиска остатков
   * @param {number} userId - Идентификатор пользователя для определения доступных подразделений
   * @returns {Promise<void>} Асинхронное выполнение без возвращаемого значения
   *
   * @throws {Error} При ошибке выполнения SQL‑запроса или отправки сообщения
   */
  async renderStockToBot(ctx: Context, nameItem: string, userId: number) {
    try {
      // Выполняем запрос к БД с типизацией результата
      const stocks: StockData[] = await this.prisma.$queryRaw`
        SELECT
          inv_stocks.id,
          inv_stocks.name,
          units.id AS "unitId",
          units.name AS "unitName",
          inv_stocks.quantity,
          inv_stocks."measurementUnit",
          inv_stocks."daysUntilBalanceRunsOut",
          units.timezone,
          (((inv_stocks."calculatedAt" AT TIME ZONE 'UTC') AT TIME ZONE units.timezone) AT TIME ZONE 'UTC') as "calculatedAtLocal",
	      inv_stocks."calculatedAt"     
        FROM public.units AS units
        JOIN public.units_departments AS ud ON units.id = ud."unitId"
        JOIN (
          SELECT DISTINCT ud2."departmentId"
          FROM public.staff_max AS sm
          JOIN public.staff AS s ON sm."staffId" = s.id
          JOIN public.units_departments AS ud2 ON s."unitId" = ud2."unitId"
          WHERE sm."idMax" = ${userId}
        ) AS user_department ON ud."departmentId" = user_department."departmentId"
        JOIN public.inventory_stocks AS inv_stocks ON inv_stocks."unitId" = units.id
        WHERE inv_stocks.name = ${nameItem}
        ORDER BY units.name ASC
      `;

      if (!stocks || stocks.length === 0) {
        await ctx.reply(`По сырью "${nameItem}" нет данных об остатках.`, { format: 'html' });
        return;
      }

      const utcDate = new Date(stocks[0].calculatedAtLocal);
      const formattedDate = utcDate.toLocaleString('ru-RU', {
        timeZone: 'UTC',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });

      // Формируем текст ответа
      let message = `Остатки <b>${nameItem}</b>\n`;
      message += `Время выгрузки с сервера: ${formattedDate}\n\n`;

      stocks.forEach((stock: StockData) => {
        const daysUntilBalance = stock.daysUntilBalanceRunsOut ?? 0;
        message += `<b>${stock.unitName}</b>\n`;
        message += `Текущий остаток: ${stock.quantity.toFixed(0)} ${convertMeasurementUnit(stock.measurementUnit)}\n`;
        message += `На сколько дней хватит остатка: ${formatDays(daysUntilBalance)}\n\n`;
      });

      // Отправляем ответ в бот
      await ctx.reply(message.trim(), { format: 'html' });
    } catch (error) {
      this.logger.error('Ошибка при получении остатков сырья:', error);
      await ctx.reply('Произошла ошибка при получении данных об остатках.', { format: 'html' });
    }
  }
}
