import { Module } from '@nestjs/common';
import { SupplyBotModule } from './supply/bot.module';


@Module({
  imports: [SupplyBotModule],
})
export class AppModule {}
