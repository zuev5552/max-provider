// handlers/general.handlers.ts
import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { WelcomeMenuService } from '../welcome/welcome-menu.service';
import { WelcomeMessageService } from '../welcome/welcome-message.service';
import { AuthService } from '@/auth/auth.service/auth.service';
import { AuthMiddleware } from '@/bot/middleware/auth.middleware';
import { EventDeduplicatorService } from '@/utils/bot/event-deduplicator.service';
import { SessionService } from '@/utils/session/session.service';

@Injectable()
export class GeneralHandlersService {
  readonly logger = new Logger(GeneralHandlersService.name);
  constructor(
    private deduplicator: EventDeduplicatorService,
    private authService: AuthService,
    private authVerification: AuthMiddleware,
    private welcomeMessageService: WelcomeMessageService,
    private welcomeMenuService: WelcomeMenuService,
    private sessionService: SessionService,
  ) {}

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

    // 1.6. Обработка отмены диалога
    bot.command('cancel', async (ctx: Context, next) => {
      const userId = ctx.user?.user_id;
      if (!userId) return await next();

      const session = this.sessionService.get(userId);
      if (session) {
        this.sessionService.delete(userId);
        await ctx.reply('Вы отменили диалог');
      }
    });

    this.logger.log('Общие обработчики успешно инициализированы');
  }
}
