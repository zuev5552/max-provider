/* eslint-disable perfectionist/sort-classes */
import { Bot, Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from './session.manager.service';

@Injectable()
export class InitChat {
  private readonly logger = new Logger(InitChat.name);

  constructor(private readonly sessionManager: SessionManagerService) {}

  initChatStart(bot: Bot): void {
    bot.command('init_chat', async (ctx: Context) => {
      const chatId = String(ctx.chatId);
      const userId = String(ctx.user?.user_id);
      if (!userId || !chatId) return;
      
      // начало диалога
      this.sessionManager.create(chatId, userId);
      console.log(this.sessionManager.get(chatId, userId));

      try {
        await bot.api.sendMessageToChat(-69845118754826, 'text1');
      } catch (e) {
        console.log(e);
        return;
      }
    });
  }
}
//   update: {
//     timestamp: 1766403443253,
//     chat_id: -69845118754826,
//     user: {
//       user_id: 25526538,
//       first_name: 'Максим',
//       last_name: 'Зуев',
//       is_bot: false,
//       last_activity_time: 1766403437000,
//       name: 'Максим Зуев'
//     },
//     user_id: 25526538,
//     is_channel: false,
//     update_type: 'bot_added'
//   }
