/* eslint-disable perfectionist/sort-classes */
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { AuthMiddleware } from '../auth.middleware';
import { commandsList } from '../commands/commandsList';
import { faq } from '../commands/faq';
import { start_bot } from '../commands/start';
import { BotProvider } from './create-bot';
import { AuthService } from '@/auth/auth.service/auth.service';
import { EventDeduplicatorService } from '@/utils/event-deduplicator.service';

/** Сервис настройки обработчиков событий для бота: команды, авторизация, дедупликация. */
@Injectable()
export class EventListenerService {
  readonly logger = new Logger (EventListenerService.name);
  constructor(
    private deduplicator: EventDeduplicatorService,
    private authService: AuthService,
    private authVerification: AuthMiddleware,
    private botProvider: BotProvider,
  ) {}

    /** Инициализирует обработчики событий бота: устанавливает команды, настраивает обработчики (bot_added, bot_started и др.), подключает middleware авторизации. При ошибке — логирует и выбрасывает исключение. @returns {Promise<void>} */
  async initListener() {
    const bot = this.botProvider.bot;
    try {
      /** установка команд */ 
      await bot.api.setMyCommands(commandsList);

      bot.command('get_myId', async (ctx: Context) => await ctx.reply(`Твой ID: ${ctx.message?.sender?.user_id}`));

      /** добавление бота в чат */
      bot.on('bot_added', async (ctx: Context, next) => {
        const key = this.deduplicator.getKey(ctx);
        if (!key || this.deduplicator.isDuplicate(key)) return await next();
        await ctx.reply(`chatID: ${ctx.chatId}. \nУкажите его в настройках Dodo-sky`);
      });

      /**сервис авторизации */
      this.authService.setupBot(bot);
      bot.on('bot_started', async ctx => {
        await ctx.reply(start_bot(), {
          attachments: [Keyboard.inlineKeyboard([[Keyboard.button.requestContact('Авторизация')]])],
        });
      });

      /**проверка авторизации */
      bot.use(this.authVerification.use.bind(this.authVerification));

      /**остальные команды авторизованного пользователя */
      bot.command('faq', async (ctx: Context) => await ctx.reply(faq(), { format: 'html' }));
    } catch (error) {
      this.logger.error(`Ошибка инициализации команд ${error}`);
    }
  }
}
