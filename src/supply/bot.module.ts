
import { Module } from '@nestjs/common';
import { SupplyBotService } from './bot.service';
import { AuthModule } from '@/auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [SupplyBotService,],
  exports: [SupplyBotService],
})
export class SupplyBotModule {}