// /* eslint-disable perfectionist/sort-classes */
// import { Injectable, Logger } from '@nestjs/common';

// import { MainBot } from '@/bot/bot-main.service';

// @Injectable()
// export class NotificationService {
//   readonly logger = new Logger(NotificationService.name);

//   constructor(private botProvider: MainBot) {}

//   /** Отправляет сообщение в указанный чат. @param chatId ID чата. @param text Текст сообщения. @returns Promise<void> */
//   async sendMessageToChat(chatId: number, text: string): Promise<void> {
//     const bot = this.botProvider.bot;
//     try {
//       await bot.api.sendMessageToChat(chatId, text);
//     } catch (error) {
//       this.logger.error(`Ошибка отправки в чат ${chatId}: ${error.message}`);
//     }
//   }

//   /** Отправляет сообщение указанному пользователю. @param userId ID пользователя. @param text Текст сообщения. @returns Promise<void> */
//   async sendMessageToUser(userId: number, text: string): Promise<void> {
//     const bot = this.botProvider.bot;
//     try {
//       await bot.api.sendMessageToUser(userId, text);
//     } catch (error) {
//       this.logger.error(`Ошибка отправки пользователю ${userId}: ${error.message}`);
//     }
//   }
// }
