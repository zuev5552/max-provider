/* eslint-disable perfectionist/sort-classes */
import { Bot } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { env } from '../../config/env';

/**
 * Сервис предоставления экземпляра бота для взаимодействия с API мессенджера.
 * Создаёт экземпляр бота при наличии токена SUPPLY_BOT_TOKEN в окружении.
 */
@Injectable()
export class CreateSupplyBot {
  bot: Bot;
  readonly logger = new Logger(CreateSupplyBot.name);

  constructor() {
    if (!env.SUPPLY_BOT_TOKEN) {
      this.logger.error('SUPPLY_BOT_TOKEN не найден в .env. Отправка сообщений будет отключена.');
      throw new Error('Token SUPPLY_BOT_TOKEN must be provided');
    }
    this.bot = new Bot(env.SUPPLY_BOT_TOKEN);
  }
}
