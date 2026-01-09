import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { BotModule } from './bot/bot.module';

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
  imports: [PrismaModule, BotModule],
})
export class AppModule {}
