
import { Module } from '@nestjs/common';
import { SupplyBotService } from './bot.service';

@Module({
  imports: [],
  providers: [SupplyBotService,],
  exports: [SupplyBotService],
})
export class SupplyBotModule {}