import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';
import { DeliverySessionService } from './delivery-session.service';

@Injectable()
export class CourierDialogService {
  private logger = new Logger(CourierDialogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly deliverySession: DeliverySessionService,
  ) {}

  async courierReply(ctx: Context, userId: number): Promise<void> {
    const courierComment = ctx.message?.body.text;
    if (!courierComment) {
      await ctx.reply('<b>Ответ не записан.</b> Принимается только текст (максимум 400 символов)', { format: 'html' });
    } else if (courierComment.length > 400) {
      await ctx.reply('<b>Ответ не записан.</b> Принимается только текст (максимум 400 символов)', { format: 'html' });
    } else {
      await ctx.reply('Ответ принят');
    }
    //         if (!ctx.message?.body) {
    //       await ctx.reply('Пожалуйста, напишите текстовое пояснение к проблемной поездке.');
    //       return;
    //     }
    //     const courierComment = ctx.message.text;
    //     const orderId = await this.getOrderIdFromSession(userId);
    //     if (!orderId) {
    //       this.logger.error(`Order ID not found for user ${userId}`);
    //       await ctx.reply('Ошибка: не найден заказ для обработки. Пожалуйста, начните диалог заново.');
    //       this.deliverySession.delete(userId);
    //       return;
    //     }
    //     // Сохраняем комментарий в БД
    //     await this.prisma.problemOrders.update({
    //       where: { orderId },
    //       data: { courierComment },
    //     });
    //     // Обновляем состояние сессии
    //     this.deliverySession.set(userId, 'waiting_photo_confirmation');
    //     // Отправляем вопрос о фотодоказательствах с клавиатурой
    //     await ctx.reply('Будет ли вы прикладывать фотодоказательства?', {
    //       reply_markup: {
    //         inline_keyboard: [[{ text: 'Да', callback_data: 'photo_yes' }], [{ text: 'Нет', callback_data: 'photo_no' }]],
    //       },
    //     });
  }
}

//   private async handlePhotoConfirmation(ctx: Context, userId: number): Promise<void> {
//     const callbackData = ctx.callbackQuery?.data;
//     if (!callbackData) return;

//     const orderId = await this.getOrderIdFromSession(userId);
//     if (!orderId) {
//       this.logger.error(`Order ID not found for user ${userId}`);
//       await ctx.reply('Ошибка: не найден заказ для обработки.');
//       this.deliverySession.delete(userId);
//       return;
//     }

//     if (callbackData === 'photo_no') {
//       // Завершаем диалог, комментарий уже сохранён
//       await ctx.reply('Спасибо за информацию. Диалог завершён.');
//       this.deliverySession.delete(userId);
//       return;
//     }

//     if (callbackData === 'photo_yes') {
//       // Переходим к ожиданию фотографий
//       this.deliverySession.set(userId, 'waiting_photos');
//       await ctx.reply('Пожалуйста, загрузите до 3 фотографий (по одной).');
//     }
//   }

//   private async handlePhotosUpload(ctx: Context, userId: number): Promise<void> {
//     if (!ctx.message?.photo) {
//       await ctx.reply('Пожалуйста, отправьте фотографии (до 3 штук по одной).');
//       return;
//     }

//     const photos = ctx.message.photo;
//     const orderId = await this.getOrderIdFromSession(userId);

//     if (!orderId) {
//       this.logger.error(`Order ID not found for user ${userId}`);
//       await ctx.reply('Ошибка: не найден заказ для обработки.');
//       this.deliverySession.delete(userId);
//       return;
//     }

//     let uploadedCount = 0;

//     for (let i = 0; i < Math.min(photos.length, 3); i++) {
//       const photo = photos[i];
//       try {
//         // Получаем файл для загрузки
//         const file = await ctx.telegram.getFile(photo.file_id);
//         const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

//         // Загружаем фото на Selectel
//         const photoUrl = await this.uploadToSelectel(fileUrl, `order_${orderId}_photo_${i + 1}.jpg`);

//         // Сохраняем URL в БД
//         await this.prisma.problemOrderPhotos.create({
//           data: {
//             orderId,
//             url: photoUrl,
//             index: i + 1,
//           },
//         });

//         uploadedCount++;
//       } catch (error) {
//         this.logger.error(`Failed to upload photo ${i + 1}:`, error);
//         await ctx.reply(`Не удалось загрузить фото ${i + 1}. Пропускаем.`);
//       }
//     }

//     // Завершаем диалог
//     await ctx.reply(
//       `Фотографии сохранены (загружено ${uploadedCount} из ${Math.min(photos.length, 3)}). Спасибо за информацию. Диалог завершён.`,
//     );
//     this.deliverySession.delete(userId);
//   }

//   private async getOrderIdFromSession(userId: number): Promise<string | null> {
//     // Здесь должна быть логика получения orderId из сессии
//     // В текущей реализации DeliverySessionService не хранит дополнительные данные
//     // Вам нужно либо расширить DeliverySessionService, либо использовать другой механизм хранения
//     // Например, можно хранить orderId в отдельном Map или в БД

//     // Заглушка — замените на реальную реализацию
//     this.logger.warn(`getOrderIdFromSession not implemented for user ${userId}`);
//     return 'test_order_id'; // замените на реальную логику получения orderId
//   }

//   private async uploadToSelectel(fileUrl: string, fileName: string): Promise<string> {
//     // Реализация загрузки на Selectel
//     // Замените на реальную логику работы с Selectel API
//     this.logger.log(`Uploading ${fileName} to Selectel from ${fileUrl}`);

//     // Имитация успешной загрузки
//     return `https://selectel-storage.example.com/${fileName}`;
//   }
// }
