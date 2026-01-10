/* eslint-disable perfectionist/sort-classes */
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../../prisma/prisma.service';
import { MessageChunkService } from '../../../../utils/bot/message-chunk.service';
import { ProblemOrderResponse } from './type';

/**
 * Сервис для работы с проблемными поездками курьера в боте
 * Предоставляет функционал просмотра проблемных заказов за последние 3 месяца
 * с разбивкой на сообщения при превышении лимита длины текста
 */
@Injectable()
export class MyProblemOrdersService {
  private readonly logger = new Logger(MyProblemOrdersService.name);

  constructor(
    private prisma: PrismaService,
    private messageChunk: MessageChunkService,
  ) {}

  /**
   * Обрабатывает команду problem_orders и отправляет ответ через ctx.reply
   * Выполняет валидацию ID пользователя, получает проблемные заказы за последние 3 месяца
   * и отправляет их частями, если сообщение превышает лимит длины
   *
   * @param ctx - контекст выполнения команды бота, содержит информацию о пользователе
   * и методы для взаимодействия с чатом
   *
   * @throws {Error} При возникновении ошибки при получении или отправке данных
   */
  async showProblemOrders(ctx: Context): Promise<void> {
    try {
      const userId = ctx.user?.user_id;
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        await ctx.reply('Некорректный ID пользователя.');
        return;
      }

      const problemOrders = await this.getProblemOrders(userId);

      let content: string;
      if (problemOrders.length === 0) {
        content = 'Поздравляем! У вас нет проблемных поездок за последние 3 месяца';
        await ctx.reply(content);
        return;
      }

      // Используем утилиту с включённой нумерацией страниц
      const chunks = this.messageChunk.chunkMessages(
        problemOrders,
        (order, index) => this.formatSingleProblemOrderMessage(order, index),
        { addPagination: true }, // Включаем нумерацию страниц
      );

      await this.sendChunks(chunks, ctx);
    } catch (error) {
      this.logger.error('Ошибка обработки команды problem_orders:', error);
      await ctx.reply('Произошла ошибка при получении проблемных поездок. Попробуйте позже.');
    }
  }

  /**
   * Получает проблемные заказы курьера за последние 3 месяца
   * Выполняет поиск staffId по ID пользователя, запрашивает данные из БД
   * и форматирует их в удобный для отображения вид
   *
   * @param idMax - ID пользователя в системе Max, используется для поиска staffId
   *
   * @returns {Promise<ProblemOrderResponse[]>} Массив отформатированных проблемных заказов
   * или пустой массив, если проблемные поездки не найдены или произошла ошибка
   *
   * @throws {Error} При ошибке выполнения запроса к БД
   */
  private async getProblemOrders(idMax: number): Promise<ProblemOrderResponse[]> {
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

      // Определяем дату 3 месяца назад
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

      // Получаем проблемные заказы за последние 3 месяца
      const problemOrders = await this.prisma.problemOrders.findMany({
        where: {
          couriersOrders: {
            courierStaffId: staffMax.staffId,
            handedOverToDeliveryAt: {
              gte: threeMonthsAgo,
            },
          },
        },
        include: {
          couriersOrders: {
            select: {
              orderNumber: true,
              handedOverToDeliveryAt: true,
            },
          },
        },
        orderBy: {
          couriersOrders: { handedOverToDeliveryAt: 'desc' },
        },
      });

      this.logger.debug(`Найдено проблемных поездок для idMax ${idMax}: ${problemOrders.length}`);

      // Форматируем результат
      return problemOrders.map(order => ({
        orderNumber: order.couriersOrders.orderNumber,
        handedOverToDeliveryAt: order.couriersOrders.handedOverToDeliveryAt,
        typeOfOffense: order.problemTypeCode,
        expiration: order.delayDuration ? Number(order.delayDuration) : null,
        courierComment: order.courierComment,
        decisionManager: order.graphManagerDecision,
        directorComment: order.directorFinalDecision,
      }));
    } catch (error) {
      this.logger.error('Ошибка при получении проблемных заказов курьера:', error);
      throw error;
    }
  }

  /**
   * Отправляет чанки сообщений
   * Принимает уже подготовленные чанки (с нумерацией страниц, если включена)
   * и последовательно отправляет их через ctx.reply с задержкой 1 секунда между сообщениями
   *
   * @param chunks - массив готовых сообщений для отправки (уже с нумерацией страниц, если включена)
   * @param ctx - контекст бота, используемый для отправки сообщений в чат
   *
   * @throws {Error} При ошибке отправки сообщения через ctx.reply — например, при проблемах с API бота
   */
  private async sendChunks(chunks: string[], ctx: Context): Promise<void> {
    for (const chunk of chunks) {
      await ctx.reply(chunk);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  /**
   * Форматирует данные одной проблемной поездки в текстовое сообщение для отправки пользователю
   * Включает номер, дату, тип проблемы, время задержки, комментарии курьера и решения руководства
   *
   * @param order - объект проблемной поездки с данными из БД, содержащий всю необходимую информацию для отображения
   * @param index - порядковый номер поездки в списке (начинается с 1), используется для нумерации в сообщении
   *
   * @returns {string} Отформатированное текстовое сообщение с информацией о проблемной поездке, готовое к отправке пользователю
   * Формат сообщения:
   * Номер: [номер в списке]
   * Дата и время: [отформатированная дата и время]
   * Номер заказа: [номер заказа]
   * Тип проблемы: [тип проблемы]
   * Время задержки: [время в минутах] минуты
   * Ваш комментарий: [комментарий курьера]
   * Решение менеджера: [решение менеджера]
   * Решение управляющего: [решение управляющего]
   */
  private formatSingleProblemOrderMessage(order: ProblemOrderResponse, index: number): string {
    let message = `Номер: ${index}\n`;
    message += `Дата и время: ${order.handedOverToDeliveryAt.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })}\n`;
    message += `Номер заказа: ${order.orderNumber}\n`;
    message += `Тип проблемы: ${order.typeOfOffense ?? 'Не указан'}\n`;
    message += `Время задержки: ${order.expiration ?? 'Не указано'} минуты\n`;
    message += `Ваш комментарий: ${order.courierComment ?? 'Не указан'}\n`;
    message += `Решение менеджера: ${order.decisionManager ?? 'Не принято'}\n`;
    message += `Решение управляющего: ${order.directorComment ?? 'Не принято'}\n`;

    return message;
  }
}
