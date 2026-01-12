import { Module } from '@nestjs/common';

import { CourierHandlersService } from './bot-handlers/courier.handlers';
import { GeneralHandlersService } from './bot-handlers/general.handlers';
import { StockHandlersService } from './bot-handlers/stock.handlers';
import { BotInitializationService } from './bot-iInitialization';
import { BotSetupService } from './bot-setup';
import { DeliveryModule } from './delivery/delivery.module';
import { DialogBlockerMiddleware } from './middleware/dialog-blocker.middleware';
import { SupplyModule } from './supply/supply.module';
import { WelcomeMenuService } from './welcome/welcome-menu.service';
import { WelcomeMessageService } from './welcome/welcome-message.service';
import { AuthModule } from '@/auth/auth.module';
import { UtilsModule } from '@/utils/utils.module';

@Module({
  imports: [AuthModule, UtilsModule, SupplyModule, DeliveryModule],
  providers: [
    BotInitializationService,
    BotSetupService,
    WelcomeMessageService,
    WelcomeMenuService,
    CourierHandlersService,
    GeneralHandlersService,
    StockHandlersService,
    DialogBlockerMiddleware,
  ],
})
export class BotModule {}
