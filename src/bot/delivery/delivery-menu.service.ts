/* eslint-disable perfectionist/sort-classes */
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class DeliveryMenuService {
  private readonly logger = new Logger(DeliveryMenuService.name);

  constructor() {}

  async showDeliveryMenu(ctx: Context): Promise<void> {
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('FAQ', 'faq-delivery')],
      [Keyboard.button.callback('QR-код для оплаты', 'qr_code')],
      [Keyboard.button.callback('Обучающий заказ', 'Обучающий заказ')],
      [Keyboard.button.callback('Размеры доплат в пиццериях', 'Размеры доплат в пиццериях')],
      [Keyboard.button.callback('Мои доплаты', 'my-salary')],
      [Keyboard.button.callback('Мои заказы за неделю', 'my-orders')],
      [Keyboard.button.callback('Мои проблемные поездки', 'my-problem-orders')],
      [Keyboard.button.callback('Рейтинг и премия за скорость', 'Рейтинг и премия за скорость')],
      [Keyboard.button.callback('Назад', 'back-welcome-menu')],
    ]);

    await ctx.reply('Выберите действие:', {
      attachments: [keyboard],
    });
  }
}
