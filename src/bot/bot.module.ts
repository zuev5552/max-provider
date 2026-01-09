import { Module } from '@nestjs/common';

import { BotInitializationService } from './bot-iInitialization';
import { BotSetupService } from './bot-setup';
import { StockAlertCallbackService } from './supply/stok-alert-callback/low-stock-callback.service';
import { SessionStockService } from './supply/show-stock/session-stock.service';
import { ShowChangeStockService } from './supply/show-stock/show-change-stock.service';
import { ShowStockService } from './supply/show-stock/show-stock.service';
import { SupplyMenuService } from './supply/supply-menu.service';
import { WelcomeMenuService } from './welcome/welcome-menu.service';
import { WelcomeMessageService } from './welcome/welcome-message.service';
import { AuthModule } from '@/auth/auth.module';
import { UtilsModule } from '@/utils/utils.module';

@Module({
  imports: [AuthModule, UtilsModule],
  providers: [
    BotInitializationService,
    BotSetupService,
    WelcomeMessageService,
    WelcomeMenuService,
    SupplyMenuService,
    ShowStockService,
    SessionStockService,
    ShowChangeStockService,
    StockAlertCallbackService,
  ],
})
export class BotModule {}
