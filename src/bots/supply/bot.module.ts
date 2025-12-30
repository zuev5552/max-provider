import { Module } from '@nestjs/common';

import { EventDeduplicatorService } from '../../utils/event-deduplicator.service';
import { AuthMiddleware } from './auth.middleware';
import { OrchestratorSupplyBot } from './bot-orchestrator';
import { BotProvider } from './service/create-bot';
import { EventListenerService } from './service/event-listener.service';
import { LowStockCallbackService } from './service/low-stock-callback.service';
import { NotificationService } from './service/notification.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    BotProvider,
    AuthMiddleware,
    EventDeduplicatorService,
    EventListenerService,
    NotificationService,
    OrchestratorSupplyBot,
    LowStockCallbackService,
  ],
  exports: [BotProvider],
})
export class SupplyBotModule {}
