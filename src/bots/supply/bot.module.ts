import { Module } from '@nestjs/common';

import { EventDeduplicatorService } from '../../utils/event-deduplicator.service';
import { AuthMiddleware } from './auth.middleware';
import { OrchestratorSupplyBot } from './bot-orchestrator';
import { CreateSupplyBot } from './create-bot';
import { EventListenerService } from './service/event-listener.service';
import { LowStockCallbackService } from './service/low-stock-callback.service';
import { NotificationService } from './service/notification.service';
import { ShowStockService } from './service/show-stock.service';
import { SessionStockService } from './service/stock-change/session-stock.service';
import { ShowChangeStockService } from './service/stock-change/show-change-stock.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [
    CreateSupplyBot,
    AuthMiddleware,
    EventDeduplicatorService,
    EventListenerService,
    NotificationService,
    OrchestratorSupplyBot,
    LowStockCallbackService,
    ShowStockService,
    ShowChangeStockService,
    SessionStockService,
  ],
  exports: [CreateSupplyBot],
})
export class SupplyBotModule {}
