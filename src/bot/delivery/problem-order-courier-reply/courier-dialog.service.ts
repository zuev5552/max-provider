/* eslint-disable perfectionist/sort-classes */
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { PhotoAttachment } from '@maxhub/max-bot-api/dist/core/network/api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';
import { FileStorageUtil } from '@/utils/core/file-storage.util';
import { SessionService } from '@/utils/session/session.service';

@Injectable()
export class CourierDialogService {
  private logger = new Logger(CourierDialogService.name);
  private fileStorage = new FileStorageUtil();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessionService: SessionService,
  ) {}

  /**Обрабатывает текстовый ответ курьера и предлагает добавить фото */
  async courierReply(ctx: Context, orderId: string): Promise<void> {
    const courierComment = ctx.message?.body.text;

    // Валидация текстового ответа
    if (!courierComment) {
      await ctx.reply('<b>Ответ не записан.</b> Принимается только текст (максимум 400 символов)', { format: 'html' });
      return;
    }

    if (courierComment.length > 400) {
      await ctx.reply('<b>Ответ не записан.</b> Принимается только текст (максимум 400 символов)', { format: 'html' });
      return;
    }

    try {
      // Обновляем в БД комментарий курьера
      await this.prisma.problemOrders.update({
        where: { orderId: orderId },
        data: { courierComment: courierComment },
      });

      // Показываем клавиатуру для выбора добавления фото
      const keyboard = [
        Keyboard.inlineKeyboard([
          [Keyboard.button.callback('Да', 'photo_yes'), Keyboard.button.callback('Нет', 'photo_no')],
        ]),
      ];

      await ctx.reply('Отлично приняли ваш ответ. Будет ли вы прикладывать фотодоказательства?', {
        attachments: keyboard,
      });
    } catch (error) {
      this.logger.error('Ошибка при сохранении комментария курьера:', error);
      await ctx.reply('Произошла ошибка при сохранении ответа. Попробуйте позже.');
    }
  }

  /** Завершает диалог без фото */
  async finishDialogNoPhoto(ctx: Context): Promise<void> {
    const userId = ctx.user?.user_id;
    if (!userId) return;

    const session = this.sessionService.get(userId);
    if (!session || !session.orderId || session.state !== 'waiting_courier_reply') return;

    try {
      // Завершаем сессию
      this.sessionService.delete(userId);

      await ctx.reply(
        'Я сохранил ваш ответ, как только управляющий примет решение, то я обязательно вам его сообщу. Спасибо за сотрудничество',
      );
    } catch (error) {
      this.logger.error('Ошибка при завершении диалога без фото:', error);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
  }

  /** Переводит сессию в состояние ожидания фото */
  async photo_yes(ctx: Context): Promise<void> {
    const userId = ctx.user?.user_id;
    if (!userId) return;

    const session = this.sessionService.get(userId);
    if (!session || !session.orderId || session.state !== 'waiting_courier_reply') return;

    try {
      // Обновляем состояние сессии
      this.sessionService.update(userId, { state: 'awaiting_photo_from_courier' });

      await ctx.reply('Отлично теперь загрузи в чат фото. Максимум 3 фотографии');
    } catch (error) {
      this.logger.error('Ошибка при переходе к загрузке фото:', error);
      await ctx.reply('Произошла ошибка. Попробуйте позже.');
    }
  }

  /** Обрабатывает загрузку фото и завершает диалог */
  async finishDialogWithPhoto(ctx: Context): Promise<void> {
    const userId = ctx.user?.user_id;
    if (!userId) return;

    const session = this.sessionService.get(userId);
    if (!session || !session.orderId || session.state !== 'awaiting_photo_from_courier') {
      return;
    }

    // Получаем все фото из сообщения
    const rawPhotos =
      ctx.message?.body?.attachments?.filter(
        (attachment): attachment is PhotoAttachment => attachment.type === 'image',
      ) || [];

    if (rawPhotos.length === 0) {
      await ctx.reply('Ошибка: фото не найдено. Пожалуйста, отправьте фото.');
      return;
    }

    // Ограничиваем до 3 фото
    const limitedPhotos = rawPhotos.slice(0, 3);

    try {
      // Загружаем фото в хранилище через утилиту
      const uploadedUrls = await this.fileStorage.uploadPhotos(limitedPhotos, session.orderId);

      if (uploadedUrls.length === 0) {
        await ctx.reply('Не удалось сохранить фото. Проверьте, что файлы доступны, и попробуйте снова.');
        return;
      }

      // Сохраняем ссылки в БД
      await this.savePhotoUrlsToDB(uploadedUrls, session.orderId);

      // Завершаем сессию
      this.sessionService.delete(userId);

      await ctx.reply(
        'Я сохранил ваш ответ и фото, как только управляющий примет решение, то я обязательно вам его сообщу. Спасибо за сотрудничество',
      );
    } catch (error) {
      this.logger.error('Критическая ошибка при сохранении фото:', error);
      await ctx.reply('Произошла серьёзная ошибка при сохранении фото. Обратитесь к администратору.');
    }
  }

  /**
   * Сохраняет URL фото в БД с индексами
   * @private
   */
  private async savePhotoUrlsToDB(urls: string[], orderId: string): Promise<void> {
    // Предварительно удаляем старые фото для этого заказа
    await this.prisma.problemOrderPhotos.deleteMany({
      where: { orderId: orderId },
    });

    // Сохраняем новые URL с индексами
    for (let i = 0; i < urls.length; i++) {
      await this.prisma.problemOrderPhotos.create({
        data: {
          orderId: orderId,
          url: urls[i],
          index: i + 1, // Позиция фото: 1, 2 или 3
        },
      });
    }
  }
}
