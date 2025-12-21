import { Module } from '@nestjs/common';
import { SupplyBotModule } from './supply/bot.module';
import { PrismaModule } from '../prisma/prisma.module';


@Module({
  imports: [SupplyBotModule, PrismaModule],
})
export class AppModule {}
