/* eslint-disable perfectionist/sort-classes */
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../../prisma/prisma.service';
import { MessageChunkService } from '../../../../utils/bot/message-chunk.service';
import { MyOrdersResponse } from './type';

/**
 * Сервис для работы с заказами курьера в боте
 * Предоставляет функционал просмотра истории заказов с разбивкой на сообщения
 * при превышении лимита длины текста
 */
@Injectable()
export class MyOrdersService {
  private readonly logger = new Logger(MyOrdersService.name);

  constructor(
    private prisma: PrismaService,
    private messageChunker: MessageChunkService,
  ) {}

  /**
   * Обрабатывает команду my_orders и отправляет ответ через ctx.reply
   * Выполняет валидацию ID пользователя, получает заказы за последние 7 дней
   * и отправляет их частями, если сообщение превышает лимит длины
   *
   * @param ctx - контекст выполнения команды бота, содержит информацию о пользователе
   * и методы для взаимодействия с чатом
   *
   * @throws {Error} При возникновении ошибки при получении или отправке данных
   */
  async showMyOrders(ctx: Context): Promise<void> {
    try {
      const userId = ctx.user?.user_id;
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        await ctx.reply('Некорректный ID пользователя.');
        return;
      }

      const orders = await this.getMyOrders(userId);

      if (orders.length === 0) {
        await ctx.reply('За последние 7 дней заказов не найдено.');
        return;
      }

      // Используем утилиту с включённой нумерацией страниц
      const chunks = this.messageChunker.chunkMessages(
        orders,
        (order, index) => this.formatSingleOrderMessage(order, index),
        { addPagination: true }, // Включаем нумерацию страниц
      );

      await this.sendChunks(chunks, ctx);
    } catch (error) {
      this.logger.error('Ошибка обработки команды my_orders:', error);
      await ctx.reply('Произошла ошибка при получении заказов. Попробуйте позже.');
    }
  }

  /**
   * Получает заказы и рейтинги курьера за последние 7 дней
   * Выполняет поиск staffId по ID пользователя, запрашивает данные из БД
   * и форматирует их в удобный для отображения вид
   *
   * @param idMax - ID пользователя в системе Max, используется для поиска staffId
   *
   * @returns {Promise<MyOrdersResponse[]>} Массив отформатированных заказов с рейтингами
   * или пустой массив, если заказы не найдены или произошла ошибка
   *
   * @throws {Error} При ошибке выполнения запроса к БД
   */
  private async getMyOrders(idMax: number): Promise<MyOrdersResponse[]> {
    try {
      // Находим staffId по idMax
      const staffMax = await this.prisma.staffMax.findUnique({
        where: { idMax },
        select: { staffId: true },
      });

      if (!staffMax?.staffId) {
        this.logger.warn(`Staff не найден для idMax: ${idMax}`);
        return [];
      }

      // Определяем дату 7 дней назад
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);

      // Получаем заказы и рейтинги за последние 7 дней — берём только первый рейтинг (гарантированно один на заказ)
      const orders = await this.prisma.couriersOrder.findMany({
        where: {
          courierStaffId: staffMax.staffId,
          handedOverToDeliveryAt: {
            gte: weekAgo,
          },
        },
        include: {
          courierOrdersRatings: {
            take: 1, // Берём только один рейтинг (по условию — в заказе всегда один рейтинг)
          },
        },
        orderBy: {
          handedOverToDeliveryAtLocal: 'desc',
        },
      });

      this.logger.debug(`Найдено заказов для idMax ${idMax}: ${orders.length}`);

      // Форматируем результат
      return orders.map(order => {
        const ratingInfo = order.courierOrdersRatings?.[0];
        const rating = ratingInfo?.rating ? Number(ratingInfo.rating.toFixed(2)) : 0;
        const causeCorrectRating = ratingInfo?.causeCorrectRating;

        const orderResponse: MyOrdersResponse = {
          handedOverToDeliveryAtLocal: order.handedOverToDeliveryAtLocal,
          orderNumber: order.orderNumber,
          predictedDeliveryTime: Math.round(order.predictedDeliveryTime / 60), // Переводим секунды в минуты
          deliveryTime: Math.round(order.deliveryTime / 60), // Переводим секунды в минуты
          rating,
        };

        // Добавляем causeCorrectRating только если он существует
        if (causeCorrectRating) {
          orderResponse.causeCorrectRating = causeCorrectRating;
        }

        return orderResponse;
      });
    } catch (error) {
      this.logger.error('Ошибка при получении заказов курьера:', error);
      throw error;
    }
  }

  /**
   * Отправляет чанки сообщений
   * Принимает уже подготовленные чанки (с нумерацией страниц, если включена)
   * и последовательно отправляет их через ctx.reply
   *
   * @param chunks - массив готовых сообщений для отправки (уже с нумерацией страниц, если включена)
   * @param ctx - контекст бота, используемый для отправки сообщений в чат
   *
   * @throws {Error} При ошибке отправки сообщения через ctx.reply — например, при проблемах с API бота
   */
  private async sendChunks(chunks: string[], ctx: Context): Promise<void> {
    for (const chunk of chunks) {
      await ctx.reply(chunk);
    }
  }

  /**
   * Форматирует данные одного заказа в текстовое сообщение для отправки пользователю
   * Включает дату, номер, прогнозное и фактическое время доставки, рейтинг и причину корректировки
   *
   * @param order - объект заказа с данными из БД, содержащий всю необходимую информацию для отображения
   * @param index - порядковый номер заказа в списке (начинается с 1), используется для нумерации в сообщении
   *
   * @returns {string} Отформатированное текстовое сообщение с информацией о заказе, готовое к отправке пользователю
   * Формат сообщения:
   * Поездка #[номер]:
   * Дата: [отформатированная дата]
   * Номер: [номер заказа]
   * Прогнозное время: [время в минутах] мин
   * Время - факт: [время в минутах] мин
   * Рейтинг: [рейтинг]
   * Причина корректировки рейтинга: [причина] (если есть)
   */
  private formatSingleOrderMessage(order: MyOrdersResponse, index: number): string {
    let message = `Поездка #${index}:\n`;
    message += `Дата: ${order.handedOverToDeliveryAtLocal.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}\n`;
    message += `Номер: ${order.orderNumber}\n`;
    message += `Прогнозное время: ${order.predictedDeliveryTime} мин\n`;
    message += `Время - факт: ${order.deliveryTime} мин\n`;
    message += `Рейтинг: ${order.rating}\n`;

    if (order.causeCorrectRating) {
      message += `Причина корректировки рейтинга: ${order.causeCorrectRating}\n`;
    }

    return message;
  }
}
