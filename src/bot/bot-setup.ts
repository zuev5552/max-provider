// bot-setup.service.ts
import { Bot } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { BotHandlerGroup } from './bot-handlers/bot-handlers.interface';
import { CourierHandlersService } from './bot-handlers/courier.handlers';
import { GeneralHandlersService } from './bot-handlers/general.handlers';
import { StockHandlersService } from './bot-handlers/stock.handlers';

@Injectable()
export class BotSetupService {
  readonly logger = new Logger(BotSetupService.name);

  constructor(
    private generalHandlers: GeneralHandlersService,
    private stockHandlers: StockHandlersService,
    private courierHandlers: CourierHandlersService,
  ) {}

  async setupHandlers(bot: Bot): Promise<void> {
    try {
      this.logger.log('Начало инициализации обработчиков бота...');

      // Собираем все обработчики
      const handlers: BotHandlerGroup[] = [this.generalHandlers, this.stockHandlers, this.courierHandlers];

      // Сортируем по приоритету (от меньшего к большему)
      const sortedHandlers = handlers.sort((a, b) => a.getPriority() - b.getPriority());

      // Последовательно инициализируем каждый обработчик
      for (const handler of sortedHandlers) {
        const handlerName = handler.constructor.name;
        this.logger.log(`Инициализация обработчика: ${handlerName} (приоритет: ${handler.getPriority()})`);

        try {
          await handler.setup(bot);
          this.logger.log(`Обработчик ${handlerName} успешно инициализирован`);
        } catch (error) {
          this.logger.error(`Ошибка при инициализации ${handlerName}:`, error);
          throw new Error(`Failed to initialize handler ${handlerName}: ${error.message}`);
        }
      }

      this.logger.log('Все обработчики успешно инициализированы');
    } catch (error) {
      this.logger.error('Критическая ошибка при инициализации обработчиков бота:', error);
      throw error;
    }
  }
}
