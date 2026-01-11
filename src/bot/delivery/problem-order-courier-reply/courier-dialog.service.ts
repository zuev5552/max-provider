import { Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';
import { SessionService } from '@/utils/session/session.service';

@Injectable()
export class CourierDialogService {
  private logger = new Logger(CourierDialogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  async courierReply(ctx: Context, orderId: string): Promise<void> {
    const courierComment = ctx.message?.body.text;
    if (!courierComment) {
      await ctx.reply('<b>Ответ не записан.</b> Принимается только текст (максимум 400 символов)', { format: 'html' });
    } else if (courierComment.length > 400) {
      await ctx.reply('<b>Ответ не записан.</b> Принимается только текст (максимум 400 символов)', { format: 'html' });
    } else {
      // Обновляем в БД комментарий курьера
      await this.prisma.problemOrders.update({
        where: { orderId: orderId },
        data: { courierComment: courierComment },
      });

      const keyboard = [
        Keyboard.inlineKeyboard([
          [Keyboard.button.callback('Да', 'photo_yes'), Keyboard.button.callback('Нет', 'photo_no')],
        ]),
      ];

      await ctx.reply('Отлично приняли ваш ответ. Будет ли вы прикладывать фотодоказательства?', {
        attachments: keyboard,
      });
    }
  }

  async finishDialogNoPhoto(ctx: Context) {
    const userId = ctx.user?.user_id;
    if (!userId) return;
    const session = this.sessionService.get(userId);
    if (!session || !session.orderId || session.state !== 'waiting_courier_reply') return;
    this.sessionService.delete(userId);
    await ctx.reply(
      'Я сохранил ваш ответ, как только управляющий примет решение, то я обязательно вам его сообщу. Спасибо за сотрудничество',
    );
  }

  async photo_yes(ctx: Context) {
    const userId = ctx.user?.user_id;
    if (!userId) return;
    const session = this.sessionService.get(userId);
    if (!session || !session.orderId || session.state !== 'waiting_courier_reply') return;
    this.sessionService.update(userId, { state: 'awaiting_photo_from_courier' });
    await ctx.reply('Отлично теперь загрузи в чат фото. Максимум 3 фотографии');
  }

  // eslint-disable-next-line perfectionist/sort-classes
  async finishDialogWithPhoto(ctx: Context) {
    const userId = ctx.user?.user_id;
    if (!userId) return;

    // сервис по сохранению ответов тут

    this.sessionService.delete(userId);
    await ctx.reply(
      'Я сохранил ваш ответ, как только управляющий примет решение то я обязательно вам его сообщу. Спасибо за сотрудничество',
    );
  }
}
