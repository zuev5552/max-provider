// handlers/general.handlers.ts
import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { WelcomeMenuService } from '../welcome/welcome-menu.service';
import { WelcomeMessageService } from '../welcome/welcome-message.service';
import { BotHandlerGroup } from './bot-handlers.interface';
import { AuthMiddleware } from '@/auth/auth.middleware';
import { AuthService } from '@/auth/auth.service/auth.service';
import { EventDeduplicatorService } from '@/utils/bot/event-deduplicator.service';

@Injectable()
export class GeneralHandlersService implements BotHandlerGroup {
  readonly logger = new Logger(GeneralHandlersService.name);
  constructor(
    private deduplicator: EventDeduplicatorService,
    private authService: AuthService,
    private authVerification: AuthMiddleware,
    private welcomeMessageService: WelcomeMessageService,
    private welcomeMenuService: WelcomeMenuService,
  ) {}

  getPriority(): number {
    return 1; // высший приоритет — загружается первым
  }

  async setup(bot: Bot): Promise<void> {
    this.logger.log('Инициализация общих обработчиков...');
    // 1.1. Установка команд MAX‑бота
    // await bot.api.setMyCommands(commandsList);

    bot.command('get_myId', async (ctx: Context) => {
      await ctx.reply(`Твой ID: ${ctx.message?.sender?.user_id}`);
    });

    // 1.2. Обработчик добавления MAX‑бота в чат
    bot.on('bot_added', async (ctx: Context, next) => {
      const key = this.deduplicator.getKey(ctx);
      if (!key || this.deduplicator.isDuplicate(key)) return await next();
      await ctx.reply(`chatID: ${ctx.chatId}. \nУкажите его в настройках Dodo-sky`);
    });

    // 1.3. Настройка авторизации для MAX‑бота
    this.authService.setupBot(bot);
    bot.on('bot_started', async (ctx: Context) => {
      await ctx.reply(this.welcomeMessageService.getWelcomeMessage(), {
        attachments: [Keyboard.inlineKeyboard([[Keyboard.button.requestContact('Авторизация')]])],
      });
    });

    // 1.4. Подключение middleware авторизации
    bot.use(this.authVerification.use.bind(this.authVerification));

    // 1.5. Обработчики команд для авторизованных пользователей
    bot.command('start', async (ctx: Context) => await this.welcomeMenuService.handleStartCommand(ctx));
    bot.action('back-welcome-menu', async (ctx: Context) => await this.welcomeMenuService.handleStartCommand(ctx));

    this.logger.log('Общие обработчики успешно инициализированы');
  }
}
