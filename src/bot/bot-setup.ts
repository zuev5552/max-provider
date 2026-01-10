/* eslint-disable perfectionist/sort-classes */
import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { commandsList } from './commands/commandsList';
import { FaqService } from './delivery/commands/faq.service';
import { MyOrdersService } from './delivery/commands/my-orders/my-orders.service';
import { MyProblemOrdersService } from './delivery/commands/my-problem-orders/my-problem-orders.service';
import { PaymentQrCodeService } from './delivery/commands/payment-qr-code/qr-code.service';
import { DeliveryMenuService } from './delivery/delivery-menu.service';
import { SessionStockService } from './supply/show-stock/session-stock.service';
import { ShowChangeStockService } from './supply/show-stock/show-change-stock.service';
import { ShowStockService } from './supply/show-stock/show-stock.service';
import { StockAlertCallbackService } from './supply/stok-alert-callback/low-stock-callback.service';
import { SupplyMenuService } from './supply/supply-menu.service';
import { WelcomeMenuService } from './welcome/welcome-menu.service';
import { WelcomeMessageService } from './welcome/welcome-message.service';
import { AuthMiddleware } from '@/auth/auth.middleware';
import { AuthService } from '@/auth/auth.service/auth.service';
import { EventDeduplicatorService } from '@/utils/bot/event-deduplicator.service';
import { CourierPremiumPaymentsService } from './delivery/commands/my-salary/my-salary.service';

/**
 * Сервис настройки обработчиков событий для MAX‑бота.
 *
 * Отвечает за:
 * - регистрацию команд бота в интерфейсе MAX;
 * - настройку обработчиков системных событий MAX (добавление в чат, запуск);
 * - интеграцию middleware авторизации;
 * - обработку взаимодействий с меню управления запасами сырья;
 * - обработку callback‑запросов и пользовательского ввода в MAX.
 */
@Injectable()
export class BotSetupService {
  readonly logger = new Logger(BotSetupService.name);

  constructor(
    private deduplicator: EventDeduplicatorService,
    private authService: AuthService,
    private authVerification: AuthMiddleware,
    private welcomeMessageService: WelcomeMessageService,
    private welcomeMenuService: WelcomeMenuService,
    private supplyMenuService: SupplyMenuService,
    private showStockService: ShowStockService,
    private sessionStockService: SessionStockService,
    private showChangeStockService: ShowChangeStockService,
    private stockAlertCallbackService: StockAlertCallbackService,
    private deliveryMenuService: DeliveryMenuService,
    private faqService: FaqService,
    private paymentQrCodeService: PaymentQrCodeService,
    private myOrdersService: MyOrdersService,
    private myProblemOrdersService: MyProblemOrdersService,
    private mySalaryService: CourierPremiumPaymentsService,
  ) {}

  /**
   * Инициализирует все обработчики событий MAX‑бота, группируя их по бизнес‑логике:
   * 1. Общий сервис (команды, добавление в чат, авторизация);
   * 2. Обработка хандлеров по программе сырья (меню, остатки, оповещения о низком уровне).
   *
   * @param {Bot} bot - экземпляр MAX‑бота для настройки обработчиков.
   *   Должен быть инициализирован и готов к регистрации обработчиков событий.
   *
   * @returns {Promise<void>} Promise, разрешающийся после полной настройки всех обработчиков MAX‑бота.
   *
   * @throws {Error} При ошибке настройки обработчиков: ошибка логируется через
   *   `this.logger.error` и выбрасывается для обработки на вышестоящем уровне.
   *
   * @example
   * ```typescript
   * const bot = new Bot(token);
   * await botSetupService.setupHandlers(bot);
   * ```
   */
  async setupHandlers(bot: Bot): Promise<void> {
    try {
      // 1. Общий сервис
      /** 1.1. Установка команд MAX‑бота */
      await bot.api.setMyCommands(commandsList);

      bot.command('get_myId', async (ctx: Context) => {
        await ctx.reply(`Твой ID: ${ctx.message?.sender?.user_id}`);
      });

      /** 1.2. Обработчик добавления MAX‑бота в чат */
      bot.on('bot_added', async (ctx: Context, next) => {
        const key = this.deduplicator.getKey(ctx);
        if (!key || this.deduplicator.isDuplicate(key)) return await next();
        await ctx.reply(`chatID: ${ctx.chatId}. \nУкажите его в настройках Dodo-sky`);
      });

      /** 1.3. Настройка авторизации для MAX‑бота */
      this.authService.setupBot(bot);
      bot.on('bot_started', async (ctx: Context) => {
        await ctx.reply(this.welcomeMessageService.getWelcomeMessage(), {
          attachments: [Keyboard.inlineKeyboard([[Keyboard.button.requestContact('Авторизация')]])],
        });
      });

      /** 1.4. Подключение middleware авторизации */
      bot.use(this.authVerification.use.bind(this.authVerification));

      /** 1.5. Обработчики команд для авторизованных пользователей */
      bot.command('start', async (ctx: Context) => await this.welcomeMenuService.handleStartCommand(ctx));
      bot.action('back-welcome-menu', async (ctx: Context) => await this.welcomeMenuService.handleStartCommand(ctx));

      // 2. Обработка хандлеров по программе сырьё
      /** 2.1. Главное меню по управлению запасами сырья */
      bot.action('service_stock_control', async (ctx: Context) => await this.supplyMenuService.showSupplyMenu(ctx));

      /** 2.2. Справка по работе с запасами сырья */
      bot.action('faq-supply', async (ctx: Context) => await this.supplyMenuService.showFaq(ctx));

      /** 2.3. Обработка ручного ввода наименования сырья */
      /** 2.3.1. Запуск сессии поиска остатков по введённому наименованию */
      bot.action('change-supply', async (ctx: Context) => await this.supplyMenuService.showChangeStock(ctx));

      /** 2.3.2. Обработка введённого пользователем наименования сырья */
      bot.on('message_created', async (ctx: Context, next) => {
        const userId = ctx.message!.sender?.user_id || ctx.user?.user_id;
        if (!ctx.message || !userId) return await next();

        const session = this.sessionStockService.get(userId);
        if (!session) return await next();
        if (session !== 'awaiting_itemName') return await next();

        await this.showChangeStockService.showChangeStock(ctx);
      });

      /** 2.4. Отображение остатков по заранее заданным позициям сырья */
      bot.action(
        [
          'Тесто 20',
          'Тесто 25',
          'Тесто 30',
          'Тесто 35',
          'Сыр моцарелла',
          'Коробка 20',
          'Коробка 25',
          'Коробка 30',
          'Коробка 35',
          'Коробка для закусок',
        ],
        async (ctx: Context) => {
          await ctx.reply('Смотрю в DodoIs остатки, ждите ...');
          await this.showStockService.showStockService(ctx);
        },
      );

      /** 2.5. Обработка callback‑запросов о низком уровне запасов (выбор решения и отображение времени на решение) */
      bot.on('message_callback', async (ctx: Context, next) => {
        const payload = ctx.callback?.payload;
        if (!payload) return await next();
        if (payload.split(':')[0] !== 'lowStock') return await next();
        const userName = ctx.callback.user.name;
        await this.stockAlertCallbackService.handleLowStockCallback(ctx, payload, userName);
      });

      // 3. Обработка хандлеров для курьеров
      /** 3.1. Главное меню сервиса для курьеров */
      bot.action('service_courier', async (ctx: Context) => await this.deliveryMenuService.showDeliveryMenu(ctx));

      /** 3.2. Справка для курьеров */
      bot.action('faq-delivery', async (ctx: Context) => await this.faqService.showFaq(ctx));

      /** 3.3. QR код для оплаты */
      bot.action('qr_code', async (ctx: Context) => await this.paymentQrCodeService.showQrCode(ctx));

      /** 3.4. Заказы курьера за неделю */
      bot.action('my-orders', async (ctx: Context) => await this.myOrdersService.showMyOrders(ctx));

      /** 3.4. Проблемные заказы курьера за 3 месяца */
      bot.action('my-problem-orders', async (ctx: Context) => await this.myProblemOrdersService.showProblemOrders(ctx));

      /** 3.5. Мои доплаты */
      bot.action('my-salary', async (ctx: Context) => await this.mySalaryService.showPremiumPayments(ctx));
    } catch (error) {
      this.logger.error(`Ошибка инициализации команд MAX-бота: ${error}`);
    }
  }
}
