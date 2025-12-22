import { Module } from '@nestjs/common';

import { AuthMiddleware } from './auth.middleware';
import { SupplyBotService } from './bot.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SupplyBotService, AuthMiddleware],
  exports: [SupplyBotService],
})
export class SupplyBotModule {}
