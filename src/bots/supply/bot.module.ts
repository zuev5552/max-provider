import { Module } from '@nestjs/common';

import { AuthMiddleware } from './auth.middleware';
import { SupplyBotService } from './bot.service';
import { InitChat } from './init-chat/init-chat.service';
import { SessionManagerService } from './init-chat/session.manager.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SupplyBotService, AuthMiddleware, InitChat, SessionManagerService],
  exports: [SupplyBotService],
})
export class SupplyBotModule {}
