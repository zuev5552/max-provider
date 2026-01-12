// handlers/stock.handlers.ts
import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { ShowChangeStockService } from '../supply/show-stock/show-change-stock.service';
import { ShowStockService } from '../supply/show-stock/show-stock.service';
import { StockAlertCallbackService } from '../supply/stok-alert-callback/low-stock-callback.service';
import { SupplyMenuService } from '../supply/supply-menu.service';
import { SessionService } from '@/utils/session/session.service';

@Injectable()
export class StockHandlersService {
  private logger = new Logger(StockHandlersService.name);

  constructor(
    private supplyMenuService: SupplyMenuService,
    private showStockService: ShowStockService,
    private showChangeStockService: ShowChangeStockService,
    private stockAlertCallbackService: StockAlertCallbackService,
    private sessionService: SessionService,
  ) {}

  async setup(bot: Bot): Promise<void> {
    this.logger.log('Инициализация обработчиков запасов сырья...');

    /** 2.1. Главное меню по управлению запасами сырья */
    bot.action('service_stock_control', async (ctx: Context) => await this.supplyMenuService.showSupplyMenu(ctx));

    /** 2.2. Справка по работе с запасами сырья */
    bot.action('faq-supply', async (ctx: Context) => await this.supplyMenuService.showFaq(ctx));

    /** 2.3. Обработка ручного ввода наименования сырья */
    /** 2.3.1. Запуск сессии поиска остатков по введённому наименованию */
    bot.action('change-supply', async (ctx: Context) => await this.supplyMenuService.showChangeStock(ctx));

    /** 2.3.2. Обработка введённого пользователем наименования сырья */
    bot.on('message_created', async (ctx: Context, next) => {
      const userId = ctx.user?.user_id || ctx.message!.sender?.user_id;
      if (!ctx.message || !userId) return await next();

      const session = this.sessionService.get(userId);
      if (!session) return await next();
      if (session.state !== 'awaiting_itemName') return await next();

      await this.showChangeStockService.showChangeStock(ctx);
    });

    /** 2.4. Отображение остатков по заранее заданным позициям сырья */
    bot.action(
      [
        'Тесто 20',
        'Тесто 25',
        'Тесто 30',
        'Тесто 35',
        'Сыр моцарелла',
        'Коробка 20',
        'Коробка 25',
        'Коробка 30',
        'Коробка 35',
        'Коробка для закусок',
      ],
      async (ctx: Context) => {
        await ctx.reply('Смотрю в DodoIs остатки, ждите ...');
        await this.showStockService.showStockService(ctx);
      },
    );

    /** 2.5. Обработка callback‑запросов о низком уровне запасов (выбор решения и отображение времени на решение) */
    bot.on('message_callback', async (ctx: Context, next) => {
      const payload = ctx.callback?.payload;
      if (!payload) return await next();
      if (payload.split(':')[0] !== 'lowStock') return await next();
      const userName = ctx.callback.user.name;
      await this.stockAlertCallbackService.handleLowStockCallback(ctx, payload, userName);
    });

    this.logger.log('Обработчики запасов сырья успешно инициализированы');
  }
}
