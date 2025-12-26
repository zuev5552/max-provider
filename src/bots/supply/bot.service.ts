import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { env } from '../../config/env';
import { AuthMiddleware } from './auth.middleware';
import { commandsList } from './commands/commandsList';
import { faq } from './commands/faq';
import { start_bot } from './commands/start';
import { AuthService } from '@/auth/auth.service/auth.service';
import { EventDeduplicatorService } from '@/utils/event-deduplicator.service';

@Injectable()
export class SupplyBotService {
  private bot: Bot;
  private readonly logger = new Logger(SupplyBotService.name);

  constructor(
    private readonly authService: AuthService,
    private readonly authVerification: AuthMiddleware,
    private deduplicator: EventDeduplicatorService,
  ) {
    if (!env.SUPPLY_BOT_TOKEN) {
      this.logger.error('SUPPLY_BOT_TOKEN не найден в .env. Отправка сообщений будет отключена.');
      throw new Error('Token SUPPLY_BOT_TOKEN must be provided');
    }
    this.bot = new Bot(env.SUPPLY_BOT_TOKEN);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.setupCommands();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.botInit();
  }

  async botInit() {
    try {
      // Авторизация
      this.authService.setupBot(this.bot);
      this.bot.on('bot_started', async ctx => {
        await ctx.reply(start_bot(), {
          attachments: [Keyboard.inlineKeyboard([[Keyboard.button.requestContact('Авторизация')]])],
        });
      });

      // команды до авторизации

      this.bot.on('bot_added', async (ctx: Context, next) => {
        //Проверяем на дубликат
        const key = this.deduplicator.getKey(ctx);
        if (!key || this.deduplicator.isDuplicate(key)) return await next();
        await ctx.reply(`chatID: ${ctx.chatId}. \nУкажите его в настройках  Dodo-sky`);
      });

      this.bot.command('get_myId', async (ctx: Context) => await ctx.reply(`Твой ID: ${ctx.message?.sender?.user_id}`));

      // Ограничение доступа без авторизации
      this.bot.use(this.authVerification.use.bind(this.authVerification));

      // прослушка команд
      this.bot.command('faq', async (ctx: Context) => await ctx.reply(faq(), { format: 'html' }));

      // запуск бота
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      this.bot.start();
      this.logger.log('SupplyBot  инициализирован и запущен');
    } catch (error) {
      this.logger.error(`Ошибка при запуске слушателя событий: ${error.message}`);
    }
  }

  async sendMessageToChat(chatId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessageToChat(chatId, text);
    } catch (error) {
      this.logger.error(`Ошибка отправки в чат ${chatId}: ${error.message}`);
    }
  }

  async sendMessageToUser(userId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessageToUser(userId, text);
    } catch (error) {
      this.logger.error(`Ошибка отправки в чат ${userId}: ${error.message}`);
    }
  }

  private async setupCommands(): Promise<void> {
    try {
      await this.bot.api.setMyCommands(commandsList);
    } catch (error) {
      this.logger.error(`Ошибка установки команд бота: ${error.message}`);
    }
  }
}
