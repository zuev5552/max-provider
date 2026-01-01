/* eslint-disable perfectionist/sort-classes */
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { AuthMiddleware } from '../auth.middleware';
import { commandsList } from '../commands/commandsList';
import { faq } from '../commands/faq';
import { start_bot } from '../commands/start';
import { BotProvider } from '../create-bot';
import { LowStockCallbackService } from './low-stock-callback.service';
import { ShowStockService } from './show-stock.service';
import { SessionStockService } from './stock-change/session-stock.service';
import { ShowChangeStockService } from './stock-change/show-change-stock.service';
import { AuthService } from '@/auth/auth.service/auth.service';
import { EventDeduplicatorService } from '@/utils/event-deduplicator.service';

/** Сервис настройки обработчиков событий для бота: команды, авторизация, дедупликация. */
@Injectable()
export class EventListenerService {
  readonly logger = new Logger(EventListenerService.name);
  constructor(
    private deduplicator: EventDeduplicatorService,
    private authService: AuthService,
    private authVerification: AuthMiddleware,
    private botProvider: BotProvider,
    private lowStockCallbackService: LowStockCallbackService,
    private showStockService: ShowStockService,
    private showChangeStockService: ShowChangeStockService,
    private readonly sessionStockService: SessionStockService,
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

      // обработка калбека
      bot.on('message_callback', async (ctx: Context) => {
        const payload = ctx.callback?.payload;
        if (!payload) return;
        const userName = ctx.callback.user.name;
        await this.lowStockCallbackService.handleLowStockCallback(ctx, payload, userName);
      });

      // показать остатки сырья
      bot.command(
        ['testo20', 'testo25', 'testo30', 'testo35', 'mozzarella', 'box20', 'box25', 'box30', 'box35', 'box'],
        async (ctx: Context) => {
          await ctx.reply('Смотрю в DodoIs остатки, ждите ...');
          await this.showStockService.showStockService(ctx);
        },
      );

      bot.command('change', async (ctx: Context) => {
        try {
          await ctx.reply('Напишите название ингредиента');

          // Формируем ключ для идентификации чата/пользователя
          const key = ctx.chatId || ctx.message?.sender?.user_id;
          if (!key) {
            this.logger.warn('Не удалось получить ключ для диалога (chatId/userId отсутствует)');
            await ctx.reply('Произошла ошибка. Попробуйте позже.');
            return;
          }

          // Сохраняем состояние диалога
          this.sessionStockService.set(key, 'awaiting_itemName');
          this.logger.log(`Диалог установлен для ключа ${key}: awaiting_itemName`);
        } catch (error) {
          this.logger.error('Ошибка в обработчике команды /change', error);
          await ctx.reply('Произошла ошибка при обработке команды. Попробуйте снова.');
        }
      });

      bot.on('message_created', async (ctx: Context, next) => {
        const key = ctx.chatId || ctx.message?.sender?.user_id;
        if (!key) return await next();
        const session = this.sessionStockService.get(key);
        if (!session || session !== 'awaiting_itemName') return await next();
        await this.showChangeStockService.showChangeStock(ctx);
      });
    } catch (error) {
      this.logger.error(`Ошибка инициализации команд ${error}`);
    }
  }
}
