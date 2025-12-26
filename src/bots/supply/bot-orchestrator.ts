/* eslint-disable perfectionist/sort-classes */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { BotProvider } from './service/create-bot';
import { EventListenerService } from './service/event-listener.service';

/**Сервис оркестрации запуска бота: настраивает слушатели событий, затем запускает бота */
@Injectable()
export class OrchestratorSupplyBot implements OnModuleInit {
  readonly logger = new Logger(OrchestratorSupplyBot.name);

  constructor(
    private eventListenerService: EventListenerService,
    private botProvider: BotProvider,
  ) {}
  /** Инициализирует модуль: настраивает слушателей событий, запускает бота; при ошибке — логирует и завершает процесс.*/
  async onModuleInit(): Promise<void> {
    try {
      await this.eventListenerService.initListener();
      await this.botProvider.bot.start();
      this.logger.log('Бот успешно запущен с настроенными слушателями');
    } catch (error) {
      this.logger.error(`Критическая ошибка при инициализации бота: ${error}`);
      process.exit(1);
    }
  }
}
