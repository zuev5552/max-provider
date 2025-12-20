import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { env } from '../config/env';
import { commandsList } from './commands/commandsList';
import { faq } from './commands/faq';
import { start_bot } from './commands/start';
import { authDialogue } from '@/auth';

@Injectable()
export class SupplyBotService {
  private bot: Bot;
  private readonly logger = new Logger(SupplyBotService.name);

  constructor() {
    if (!env.SUPPLY_BOT_TOKEN) {
      this.logger.error('SUPPLY_BOT_TOKEN не найден в .env. Отправка сообщений будет отключена.');
      throw new Error('Token SUPPLY_BOT_TOKEN must be provided');
    }
    this.bot = new Bot(env.SUPPLY_BOT_TOKEN);
    this.setupCommands();
    this.eventListener();
  }

  // Установка команд бота
  private async setupCommands(): Promise<void> {
    try {
      await this.bot.api.setMyCommands(commandsList);
    } catch (error) {
      this.logger.error(`Ошибка установки команд бота: ${error.message}`);
    }
  }

  // Методы прослушивающие сообщения
  async eventListener() {
    try {

      this.bot.on('bot_started', async ctx => {
        await ctx.reply(start_bot(), {
          attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('Авторизация', 'auth_start')]])],
        });
      });

      authDialogue(this.bot);

      // прослушка команд
      this.bot.command('faq', async (ctx: Context) => await ctx.reply(faq(), { format: 'html' }));

      // запуск бота
      this.bot.start();
      this.logger.log('SupplyBot  инициализирован и запущен');
    } catch (error) {
      this.logger.error(`Ошибка при запуске слушателя событий: ${error.message}`);
    }
  }
  // Методы отправки сообщений через бота
  async sendMessageToUser(userId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessageToUser(userId, text);
    } catch (error) {
      this.logger.error(`Ошибка отправки в чат ${userId}: ${error.message}`);
    }
  }
  async sendMessageToChat(chatId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessageToChat(chatId, text);
    } catch (error) {
      this.logger.error(`Ошибка отправки в чат ${chatId}: ${error.message}`);
    }
  }
}
