import { Module } from '@nestjs/common';

import { EventDeduplicatorService } from '../../utils/event-deduplicator.service';
import { AuthMiddleware } from './auth.middleware';
import { SupplyBotService } from './bot.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SupplyBotService, AuthMiddleware, EventDeduplicatorService],
  exports: [SupplyBotService],
})
export class SupplyBotModule {}
