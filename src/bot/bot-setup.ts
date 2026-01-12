// bot-setup.service.ts
import { Bot } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

// import { BotHandlerGroup } from './bot-handlers/bot-handlers.interface';
import { CourierHandlersService } from './bot-handlers/courier.handlers';
import { GeneralHandlersService } from './bot-handlers/general.handlers';
import { StockHandlersService } from './bot-handlers/stock.handlers';
import { DialogBlockerMiddleware } from './middleware/dialog-blocker.middleware';

@Injectable()
export class BotSetupService {
  readonly logger = new Logger(BotSetupService.name);

  constructor(
    private generalHandlers: GeneralHandlersService,
    private stockHandlers: StockHandlersService,
    private courierHandlers: CourierHandlersService,
    private dialogBlocker: DialogBlockerMiddleware,
  ) {}

  async setupHandlers(bot: Bot): Promise<void> {
    try {
      // Регистрируем middleware для блокировки команд во время активного диалога — первым!
      bot.use(this.dialogBlocker.use.bind(this.dialogBlocker));

      await this.generalHandlers.setup(bot);
      await this.stockHandlers.setup(bot);
      await this.courierHandlers.setup(bot);
    } catch (error) {
      this.logger.error('Критическая ошибка при инициализации обработчиков бота:', error);
      throw error;
    }
  }
}
