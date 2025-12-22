import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../prisma/prisma.service';
import { env } from '../../config/env';
import { commandsList } from './commands/commandsList';
import { faq } from './commands/faq';
import { start_bot } from './commands/start';
import { AuthService } from '@/auth/auth.service';

/**
 * Сервис для работы с ботом SupplyBot.
 *
 * Обеспечивает:
 * - инициализацию бота с токеном из окружения;
 * - установку команд бота;
 * - обработку событий (старт бота, входящие сообщения);
 * - проверку авторизации пользователей;
 * - отправку сообщений пользователям и в чаты.
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
   * Инициализирует бота, проверяет наличие токена, настраивает команды и обработчики событий.
   *
   * @param {AuthService} authService - сервис авторизации пользователей
   * @param {PrismaService} prisma - сервис для взаимодействия с базой данных
   */
  constructor(
    private readonly authService: AuthService,
    private readonly prisma: PrismaService,
  ) {
    if (!env.SUPPLY_BOT_TOKEN) {
      this.logger.error('SUPPLY_BOT_TOKEN не найден в .env. Отправка сообщений будет отключена.');
      throw new Error('Token SUPPLY_BOT_TOKEN must be provided');
    }
    this.bot = new Bot(env.SUPPLY_BOT_TOKEN);

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.setupCommands();
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    this.eventListener();
  }
  /**
   * Настраивает обработчики событий бота:
   * - старт бота;
   *  перед проверкой входящих сообщений проверяется авторизация пользователя
   * - входящие сообщения;
   * - команды.
   *
   * Включает проверку авторизации пользователей перед обработкой сообщений.
   *
   * @async
   * @returns {Promise<void>}
   * @throws {Error} При ошибке настройки обработчиков
   */
  async eventListener() {
    try {
      // Авторизация
      this.authService.setupBot(this.bot);

      this.bot.on('bot_started', async ctx => {
        await ctx.reply(start_bot(), {
          attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('Авторизация', 'auth_start')]])],
        });
      });

      // Проверяем авторизацию
      this.bot.on('message_created', async (ctx: Context, next) => {
        // 1. Безопасное получение userId с валидацией
        const userId = ctx.message?.sender?.user_id;

        if (!userId) {
          this.logger.warn('Не удалось определить userId из контекста сообщения');
          return next(); // Передаём управление дальше, если userId не найден
        }

        try {
          // 2. Проверка авторизации с учётом статуса сотрудника
          const authorizedRecord = await this.prisma.staffMax.findUnique({
            where: { idMax: userId },
            include: {
              staff: {
                select: { status: true },
              },
            },
          });

          // Если уволен или нет в БД то запрашиваем авторизацию
          const isAuthorized =
            authorizedRecord !== null &&
            authorizedRecord.staff !== null &&
            ['Active', 'Suspended'].includes(authorizedRecord.staff.status);

          // 3. Обработка неавторизованного пользователя
          if (!isAuthorized) {
            await ctx.reply('Сервис доступен только для авторизованных пользователей', {
              attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('Авторизация', 'auth_start')]])],
            });
            return; // Прерываем цепочку, не вызываем next()
          }

          // 4. Для авторизованных — передаём управление дальше по middleware
          await next();
        } catch (error) {
          this.logger.error(`Ошибка при проверке авторизации пользователя ${userId}: ${error.message}`, error);

          // В случае ошибки тоже не даём доступ к функционалу
          await ctx.reply('Произошла ошибка при проверке авторизации. Попробуйте позже.', {
            attachments: [Keyboard.inlineKeyboard([[Keyboard.button.callback('Авторизация', 'auth_start')]])],
          });
        }
      });

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

  /**
   * Отправляет сообщение в указанный чат.
   *
   * @async
   * @param {number} chatId - ID чата, в который отправляется сообщение
   * @param {string} text - текст сообщения
   * @returns {Promise<void>}
   * @throws {Error} При ошибке отправки сообщения
   */
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
