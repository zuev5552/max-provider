import { Module } from '@nestjs/common';
import { SupplyBotModule } from './supply/bot.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SMSRuModule } from 'node-sms-ru/nestjs';

import { env } from './config/env';

/**
 * Основной модуль приложения NestJS.
 *
 * Этот модуль объединяет ключевые функциональные блоки приложения:
 * - интеграцию с SMS-сервисом SMS.ru;
 * - модуль работы с ботом для управления поставками;
 * - модуль доступа к базе данных через Prisma.
 *
 * @module AppModule
 */
@Module({
  imports: [SMSRuModule.forRoot({ api_id: env.SMS_RU_API_ID }), SupplyBotModule, PrismaModule],
})
export class AppModule {}
