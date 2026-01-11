/* eslint-disable perfectionist/sort-classes */
import { Bot } from '@maxhub/max-bot-api';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { env } from 'config/env';

import { BotSetupService } from './bot-setup';

/**
 * Сервис предоставления экземпляра бота для взаимодействия с API мессенджера.
 * Создаёт экземпляр бота при наличии токена SUPPLY_BOT_TOKEN в окружении.
 */
@Injectable()
export class BotInitializationService implements OnModuleInit {
  bot: Bot;
  readonly logger = new Logger(BotInitializationService.name);

  constructor(private botSetupService: BotSetupService) {
    if (!env.BOT_TOKEN) {
      this.logger.error('SUPPLY_BOT_TOKEN не найден в .env. Отправка сообщений будет отключена.');
      throw new Error('Token SUPPLY_BOT_TOKEN must be provided');
    }
    this.bot = new Bot(env.BOT_TOKEN);
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.botSetupService.setupHandlers(this.bot);
      await this.bot.start();
      this.logger.log('Бот успешно запущен с настроенными слушателями');
    } catch (error) {
      this.logger.error(`Критическая ошибка при инициализации бота: ${error}`);
      process.exit(1);
    }
  }
}
