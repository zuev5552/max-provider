// handlers/courier.handlers.ts
import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { FaqService } from '../delivery/commands/faq.service';
import { MyOrdersService } from '../delivery/commands/my-orders/my-orders.service';
import { MyProblemOrdersService } from '../delivery/commands/my-problem-orders/my-problem-orders.service';
import { CourierPremiumPaymentsService } from '../delivery/commands/my-salary/my-salary.service';
import { PaymentQrCodeService } from '../delivery/commands/payment-qr-code/qr-code.service';
import { DeliveryMenuService } from '../delivery/delivery-menu.service';
import { CourierDialogService } from '../delivery/problem-order-courier-reply/courier-dialog.service';
import { BotHandlerGroup } from './bot-handlers.interface';
import { SessionService } from '@/utils/session/session.service';

@Injectable()
export class CourierHandlersService implements BotHandlerGroup {
  private logger = new Logger(CourierHandlersService.name);

  constructor(
    private deliveryMenuService: DeliveryMenuService,
    private faqService: FaqService,
    private paymentQrCodeService: PaymentQrCodeService,
    private myOrdersService: MyOrdersService,
    private myProblemOrdersService: MyProblemOrdersService,
    private mySalaryService: CourierPremiumPaymentsService,
    private courierDialog: CourierDialogService,
    private sessionService: SessionService,
  ) {}

  getPriority(): number {
    return 3; // загружается последним
  }

  async setup(bot: Bot): Promise<void> {
    this.logger.log('Инициализация обработчиков курьеров...');
    // 3. Обработка хандлеров для курьеров

    /** 3.1 Обработка ответа курьера по проблемной поездке */
    /** 3.1.1 Старт сессии */
    bot.on('message_callback', async (ctx: Context, next) => {
      const userId = ctx.user?.user_id;
      if (!userId) return await next();
      const payload = ctx.callback?.payload;
      if (!payload) return await next();
      const orderId = payload.split(':')[1];
      if (payload.split(':')[0] !== 'problemOrderReply') return await next();
      this.sessionService.create(userId, { state: 'waiting_courier_reply', orderId });
      await ctx.reply('Напишите текстом ваш ответ (максимум 400 символов)');
    });

    /** 3.1.2. Обработка введённого курьером ответа (фото или текст) */
    bot.on('message_created', async (ctx: Context, next) => {
      const userId = ctx.user?.user_id;
      if (!userId) return await next();

      const session = this.sessionService.get(userId);
      if (!session || !session.orderId) return await next();

      switch (session.state) {
        case 'waiting_courier_reply':
          await this.courierDialog.courierReply(ctx, session.orderId);
          break;
        case 'awaiting_photo_from_courier':
          await this.courierDialog.finishDialogWithPhoto(ctx);
          break;
        default:
          return await next();
      }
    });
    /** 3.1.3. Обработка добавления фото */
    bot.action('photo_no', async (ctx: Context) => await this.courierDialog.finishDialogNoPhoto(ctx));
    bot.action('photo_yes', async (ctx: Context) => await this.courierDialog.photo_yes(ctx));

    /** 3.2. Главное меню сервиса для курьеров */
    bot.action('service_courier', async (ctx: Context) => await this.deliveryMenuService.showDeliveryMenu(ctx));

    /** 3.2.1. Справка для курьеров */
    bot.action('faq-delivery', async (ctx: Context) => await this.faqService.showFaq(ctx));

    /** 3.2.2. QR код для оплаты */
    bot.action('qr_code', async (ctx: Context) => await this.paymentQrCodeService.showQrCode(ctx));

    /** 3.2.3. Заказы курьера за неделю */
    bot.action('my-orders', async (ctx: Context) => await this.myOrdersService.showMyOrders(ctx));

    /** 3.2.4. Проблемные заказы курьера за 3 месяца */
    bot.action('my-problem-orders', async (ctx: Context) => await this.myProblemOrdersService.showProblemOrders(ctx));

    /** 3.2.5. Мои доплаты */
    bot.action('my-salary', async (ctx: Context) => await this.mySalaryService.showPremiumPayments(ctx));

    this.logger.log('Обработчики курьеров успешно инициализированы');
  }
}
