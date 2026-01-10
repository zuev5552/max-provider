/* eslint-disable perfectionist/sort-classes */
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../../prisma/prisma.service';
import { MessageChunkService } from '../../../../utils/bot/message-chunk.service';
import { PremiumPaymentResponse } from './type';

/**
 * Сервис для работы с доплатами курьеров в боте
 * Предоставляет функционал просмотра доплат за последние 10 дней
 * с группировкой по дням и типам доплат, разбивкой на сообщения
 * при превышении лимита длины текста
 */
@Injectable()
export class CourierPremiumPaymentsService {
  private readonly logger = new Logger(CourierPremiumPaymentsService.name);
  private readonly CHUNK_DELAY_MS = 1000; // Задержка между отправкой чанков в мс

  constructor(
    private prisma: PrismaService,
    private messageChunk: MessageChunkService,
  ) {}

  /**
   * Обрабатывает команду premium_payments и отправляет отчёт о доплатах за последние 10 дней
   * Выполняет валидацию ID пользователя, получает данные, группирует по дням и отправляет частями
   *
   * @param ctx - контекст выполнения команды бота, содержит информацию о пользователе
   * и методы для взаимодействия с чатом
   *
   * @throws {Error} При возникновении ошибки при получении или отправке данных
   */
  async showPremiumPayments(ctx: Context): Promise<void> {
    try {
      const userId = ctx.user?.user_id;
      if (!userId || typeof userId !== 'number' || userId <= 0) {
        await ctx.reply('Некорректный ID пользователя.');
        return;
      }

      const premiumPayments = await this.getRecentPremiumPayments(userId);

      let content: string;
      if (premiumPayments.length === 0) {
        content = 'За последние 10 дней у вас нет начисленных доплат';
        await ctx.reply(content);
        return;
      }

      // Используем утилиту с включённой нумерацией страниц
      const chunks = this.messageChunk.chunkMessages(
        premiumPayments,
        (payment, index) => this.formatSinglePremiumPaymentMessage(payment, index),
        { addPagination: true }, // Включаем нумерацию страниц
      );

      await this.sendChunks(chunks, ctx);
    } catch (error) {
      this.logger.error('Ошибка обработки команды premium_payments:', error);
      await ctx.reply('Произошла ошибка при получении информации о доплатах. Попробуйте позже.');
    }
  }

  /**
   * Получает доплаты курьера за последние 10 дней с группировкой по дате и типу доплаты
   * Выполняет поиск staffId по ID пользователя, запрашивает данные из БД
   * и форматирует их в удобный для отображения вид
   *
   * @param idMax - ID пользователя в системе Max, используется для поиска staffId
   *
   * @returns {Promise<PremiumPaymentResponse[]>} Массив сгруппированных и отформатированных доплат
   * или пустой массив, если доплаты не найдены или произошла ошибка
   *
   * @throws {Error} При ошибке выполнения запроса к БД
   */
  private async getRecentPremiumPayments(idMax: number): Promise<PremiumPaymentResponse[]> {
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

      // Определяем дату 10 дней назад
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      // Получаем доплаты за последние 10 дней
      const premiumPayments = await this.prisma.premiumApplication.findMany({
        where: {
          staffId: staffMax.staffId,
          datePremium: {
            gte: tenDaysAgo,
          },
        },
        orderBy: {
          datePremium: 'desc',
        },
      });

      this.logger.debug(`Найдено доплат для idMax ${idMax}: ${premiumPayments.length}`);

      // Группируем данные по дате и типу доплаты, суммируем суммы
      const groupedPayments: PremiumPaymentResponse[] = [];
      const paymentsByDate: { [date: string]: PremiumPaymentResponse[] } = {};

      premiumPayments.forEach(payment => {
        const formattedDate = payment.datePremium.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
        });

        if (!paymentsByDate[formattedDate]) {
          paymentsByDate[formattedDate] = [];
        }

        paymentsByDate[formattedDate].push({
          amount: payment.amount.toString(),
          namePremium: payment.namePremium,
          datePremium: payment.datePremium,
          formattedDate,
        });
      });

      // Суммируем суммы по типам доплат внутри каждой даты
      Object.entries(paymentsByDate).forEach(([date, payments]) => {
        const paymentsByType: { [type: string]: number } = {};

        payments.forEach(p => {
          const amount = parseFloat(p.amount);
          paymentsByType[p.namePremium] = (paymentsByType[p.namePremium] || 0) + amount;
        });

        // Добавляем сгруппированные записи
        Object.entries(paymentsByType).forEach(([type, totalAmount]) => {
          groupedPayments.push({
            amount: totalAmount.toFixed(2),
            namePremium: type,
            datePremium: payments[0].datePremium,
            formattedDate: date,
          });
        });
      });

      return groupedPayments;
    } catch (error) {
      this.logger.error(`Ошибка при получении доплат курьера для idMax ${idMax}:`, error);
      throw error;
    }
  }

  /**
   * Отправляет чанки сообщений с задержкой между ними
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
      await new Promise(resolve => setTimeout(resolve, this.CHUNK_DELAY_MS));
    }
  }

  /**
   * Форматирует данные одной доплаты в текстовое сообщение для отправки пользователю
   * Включает номер, дату начисления (без времени), название доплаты и сумму
   *
   * @param payment - объект доплаты с данными из БД, содержащий всю необходимую информацию для отображения
   * @param index - порядковый номер доплаты в списке (начинается с 1), используется для нумерации в сообщении
   *
   * @returns {string} Отформатированное текстовое сообщение с информацией о доплате, готовое к отправке пользователю
   * Формат сообщения:
   * Номер: [номер в списке]
   * Дата начисления: [отформатированная дата в формате ДД.ММ.ГГГГ]
   * Название доплаты: [название доплаты]
   * Сумма: [сумма доплаты] руб.
   */
  private formatSinglePremiumPaymentMessage(payment: PremiumPaymentResponse, index: number): string {
    let message = `Номер: ${index}\n`;
    message += `Дата начисления: ${payment.datePremium.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })}\n`;
    message += `Название доплаты: ${payment.namePremium}\n`;
    message += `Сумма: ${payment.amount} руб.\n`;

    return message;
  }
}
