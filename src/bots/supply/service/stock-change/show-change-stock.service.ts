/* eslint-disable perfectionist/sort-classes */
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../../prisma/prisma.service';
import { ShowStockService } from '../show-stock.service';
import { SessionStockService } from './session-stock.service';

/**
 * Сервис для обработки команд изменения запасов сырья через бота.
 * Отвечает за:
 * - поиск товара по наименованию (с игнорированием регистра);
 * - отображение информации о запасах;
 * - управление сессиями диалогов;
 * - предоставление списка корректных наименований при ошибке ввода.
 */
@Injectable()
export class ShowChangeStockService {
  private readonly logger = new Logger(ShowChangeStockService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionStockService: SessionStockService,
    private readonly showStockService: ShowStockService,
  ) {}

  /**
   * Обрабатывает запрос пользователя на отображение запасов по наименованию сырья.
   *
   * Пошаговая логика:
   * 1. Извлекает идентификатор сессии, ввод пользователя и ID пользователя.
   * 2. Проверяет наличие обязательных данных.
   * 3. Выполняет регистронезависимый поиск товара в БД.
   * 4. Если товар найден: отображает информацию о запасах и очищает сессию.
   * 5. Если товар не найден: получает полный список наименований и отправляет пользователю.
   *
   * @param {Context} ctx - Контекст сообщения от бота (содержит данные о чате, пользователе, сообщении)
   * @returns {Promise<void>} - Асинхронное выполнение без возвращаемого значения
   *
   * @example
   * // Пользователь отправляет: "Брынза"
   * // Если найден: показывает запасы и удаляет сессию
   * // Если не найден: отправляет список всех доступных наименований
   */
  async showChangeStock(ctx: Context): Promise<void> {
    /** Уникальный идентификатор сессии (chatId или user_id отправителя). */
    const key = ctx.chatId || ctx.message?.sender?.user_id;
    /** Введённое пользователем наименование сырья для поиска. */
    const nameFromUser = ctx.message?.body.text;
    /** Идентификатор пользователя для персонализации ответа. */
    const userId = ctx.user?.user_id;
    if (!nameFromUser || !userId || !key) return;
    const item = await this.prisma.inventoryItem.findFirst({
      where: {
        name: {
          equals: nameFromUser,
          mode: 'insensitive',
        },
      },
    });
    if (item?.name) {
      await this.showStockService.renderStockToBot(ctx, item?.name, userId);
      this.sessionStockService.delete(key);
    } else {
      // Получаем список всех доступных наименований сырья
      const allItems = await this.prisma.inventoryItem.findMany({
        select: { name: true },
        orderBy: { name: 'asc' }, // Сортируем по алфавиту для удобства пользователя
      });

      // Формируем список наименований
      const itemNames = allItems.map(item => item.name).join('\n');

      // Отправляем сообщение пользователю
      await ctx.reply(`Вы ввели неверное наименование сырья. Вот список правильных наименований:\n\n${itemNames}`);
    }
  }
}
