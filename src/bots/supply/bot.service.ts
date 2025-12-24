import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { env } from '../../config/env';
import { AuthMiddleware } from './auth.middleware';
import { commandsList } from './commands/commandsList';
import { faq } from './commands/faq';
import { start_bot } from './commands/start';
import { InitChat } from './init-chat/init-chat.service';
import { AuthService } from '@/auth/auth.service/auth.service';

/**
 * Сервис для работы с ботом SupplyBot.
 *
 * Отвечает за:
 * - инициализацию бота с токеном из окружения;
 * - установку списка команд в интерфейсе платформы;
 * - настройку обработчиков событий (старт бота, входящие сообщения);
 * - проверку авторизации пользователей через middleware;
 * - отправку сообщений в чаты и конкретным пользователям.
 *
 * @Injectable
 * @class SupplyBotService
 */
@Injectable()
export class SupplyBotService {
  private bot: Bot;
  private readonly logger = new Logger(SupplyBotService.name);

  /**
   * Конструктор сервиса.
   *
   * Инициализирует экземпляр бота, проверяет наличие токена в окружении,
   * запускает настройку команд и обработчиков событий.
   *
   * @param {AuthService} authService - сервис для управления авторизацией пользователей
   * @param {AuthMiddleware} authVerification - middleware для проверки авторизации
   * @throws {Error} Если токен SUPPLY_BOT_TOKEN не найден в окружении
   */
  constructor(
    private readonly authService: AuthService,
    private readonly authVerification: AuthMiddleware,
    private readonly initChat: InitChat,
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

  /**
   * Настраивает основные обработчики событий бота:
   * - инициализацию системы авторизации;
   * - обработчик события старта бота (отправляет приветственное сообщение);
   * - middleware проверки авторизации для всех последующих сообщений;
   * - прослушку команды /faq;
   * - запуск бота.
   *
   * @async
   * @returns {Promise<void>}
   * @throws {Error} При ошибке настройки обработчиков или запуска бота
   */
  async botInit() {
    try {
      // Авторизация
      this.authService.setupBot(this.bot);
      this.bot.on('bot_started', async ctx => {
        await ctx.reply(start_bot(), {
          attachments: [Keyboard.inlineKeyboard([[Keyboard.button.requestContact('Авторизация')]])],
        });
      });

      // Ограничение доступа без авторизации
      this.bot.use(this.authVerification.use.bind(this.authVerification));

      // Инициализация чатов
      this.initChat.initChatStart(this.bot);

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

  /**
   * Отправляет сообщение указанному пользователю.
   *
   * @async
   * @param {number} userId - ID пользователя, которому отправляется сообщение
   * @param {string} text - текст сообщения
   * @returns {Promise<void>}
   * @throws {Error} При ошибке отправки сообщения
   */
  async sendMessageToUser(userId: number, text: string): Promise<void> {
    try {
      await this.bot.api.sendMessageToUser(userId, text);
    } catch (error) {
      this.logger.error(`Ошибка отправки в чат ${userId}: ${error.message}`);
    }
  }

  /**
   * Устанавливает список команд бота в интерфейсе платформы.
   *
   * @private
   * @async
   * @returns {Promise<void>}
   * @throws {Error} При ошибке установки команд
   */
  private async setupCommands(): Promise<void> {
    try {
      await this.bot.api.setMyCommands(commandsList);
    } catch (error) {
      this.logger.error(`Ошибка установки команд бота: ${error.message}`);
    }
  }
}
