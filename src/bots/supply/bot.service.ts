/* eslint-disable perfectionist/sort-classes */
import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';

import { env } from '../../config/env';
import { AuthMiddleware } from './auth.middleware';
import { commandsList } from './commands/commandsList';
import { faq } from './commands/faq';
import { start_bot } from './commands/start';
import { AuthService } from '@/auth/auth.service/auth.service';
import { EventDeduplicatorService } from '@/utils/event-deduplicator.service';

/** Сервис Telegram‑бота SupplyBot: инициализация, команды, обработка сообщений и отправка уведомлений. */
@Injectable()
export class SupplyBotService implements OnModuleInit {
  private bot: Bot;
  private readonly logger = new Logger(SupplyBotService.name);

  /**
   * Конструктор сервиса SupplyBotService: инициализирует бота и проверяет токен в .env.
   * @param authService Сервис аутентификации пользователей.
   * @param authVerification Middleware для проверки авторизации.
   * @param deduplicator Сервис дедупликации событий.
   */
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
  }

  /** Выполняет инициализацию команд и запуск бота */
  async onModuleInit(): Promise<void> {
    await this.setupCommands();
    await this.setupEventHandlers();

    // запуск бота
    await this.bot.start();
    this.logger.log('SupplyBot инициализирован и запущен');
  }

  /** Устанавливает список команд для бота в интерфейсе MAX (из commandsList). @returns Promise<void> */
  private async setupCommands(): Promise<void> {
    try {
      await this.bot.api.setMyCommands(commandsList);
    } catch (error) {
      this.logger.error(`Ошибка установки команд бота: ${error.message}`);
    }
  }

  /** Асинхронная инициализация бота: настройка обработчиков событий, команд и авторизации. */
  async setupEventHandlers() {
    try {
      // Авторизация
      this.authService.setupBot(this.bot);
      this.bot.on('bot_started', async ctx => {
        await ctx.reply(start_bot(), {
          attachments: [Keyboard.inlineKeyboard([[Keyboard.button.requestContact('Авторизация')]])],
        });
      });

      // Обработчик добавления бота в чат: проверяет дубликат и отправляет chatID.
      this.bot.on('bot_added', async (ctx: Context, next) => {
        const key = this.deduplicator.getKey(ctx);
        if (!key || this.deduplicator.isDuplicate(key)) return await next();
        await ctx.reply(`chatID: ${ctx.chatId}. \nУкажите его в настройках Dodo-sky`);
      });

      // Команда /get_myId: отправляет пользователю его ID.
      this.bot.command('get_myId', async (ctx: Context) => await ctx.reply(`Твой ID: ${ctx.message?.sender?.user_id}`));

      // Ограничение доступа без авторизации
      this.bot.use(this.authVerification.use.bind(this.authVerification));

      // Команда /faq: отправляет справку в формате HTML.
      this.bot.command('faq', async (ctx: Context) => await ctx.reply(faq(), { format: 'html' }));
    } catch (error) {
      this.logger.error(`Ошибка при запуске слушателя событий: ${error.message}`);
    }
  }

  /** Отправляет сообщение в указанный чат. @param chatId ID чата. @param text Текст сообщения. @returns Promise<void> */
  async sendMessageToChat(chatId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessageToChat(chatId, text);
    } catch (error) {
      this.logger.error(`Ошибка отправки в чат ${chatId}: ${error.message}`);
    }
  }

  /** Отправляет сообщение указанному пользователю. @param userId ID пользователя. @param text Текст сообщения. @returns Promise<void> */
  async sendMessageToUser(userId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessageToUser(userId, text);
    } catch (error) {
      this.logger.error(`Ошибка отправки пользователю ${userId}: ${error.message}`);
    }
  }
}
