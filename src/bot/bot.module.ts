import { Module } from '@nestjs/common';

import { BotInitializationService } from './bot-iInitialization';
import { BotSetupService } from './bot-setup';
import { DeliveryModule } from './delivery/delivery.module';
import { SupplyModule } from './supply/supply.module';
import { WelcomeMenuService } from './welcome/welcome-menu.service';
import { WelcomeMessageService } from './welcome/welcome-message.service';
import { AuthModule } from '@/auth/auth.module';
import { UtilsModule } from '@/utils/utils.module';

@Module({
  imports: [AuthModule, UtilsModule, SupplyModule, DeliveryModule],
  providers: [BotInitializationService, BotSetupService, WelcomeMessageService, WelcomeMenuService],
})
export class BotModule {}
