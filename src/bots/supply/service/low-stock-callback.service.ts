// services/low-stock-callback.service.ts
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';
import { LowStockCallbackData } from '../types/low-stock-callback-data.types';

@Injectable()
export class LowStockCallbackService {
  private readonly logger = new Logger(LowStockCallbackService.name);

  constructor(private readonly prisma: PrismaService) {}

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

      // Редактируем сообщение: оставляем только выбранную кнопку
      await ctx.editMessage({
        text: `✅ Задача выполнена
Проблемное сырье: <b>${item.name}</b>
Выбранная причина: ${callbackData.reason}
Время выполнения задачи: ${new Date().toLocaleString('ru-RU')}\n`,
        format: 'html',
      });
    } catch (error) {
      this.logger.error(`Ошибка в калбеке ${error}`);
    }
  }

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
