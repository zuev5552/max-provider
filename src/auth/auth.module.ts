import { Module } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CodeGeneratorService } from '../utils/code.generator.service';
import { PhoneValidationService } from '../utils/phone.validation.service';
import { AuthService } from './auth.service/auth.service';
import { AuthStartHandler } from './auth.service/handlers/auth-start.handler';
import { MessageHandler } from './auth.service/handlers/message.handler';
import { PhoneConfirmationHandler } from './auth.service/handlers/phone-confirmation.handler';
import { IdMaxService } from './auth.service/idmax.service';
import { SessionManagerService } from './auth.service/session.manager.service';
import { CodeStepHandler } from './auth.service/steps/code-step.handler';
import { FullnameStepHandler } from './auth.service/steps/fullname-step.handler';
import { PhoneStepHandler } from './auth.service/steps/phone-step.handler';
import { SessionTimeoutUtil } from './auth.service/utils/session-timeout.util';
import { SmsSenderUtil } from './auth.service/utils/sms-sender.util';

/**
 * Модуль аутентификации для MAX бота в NestJS‑приложении.
 *
 * Централизует все компоненты, необходимые для реализации процесса аутентификации пользователей,
 * включая управление сессиями, валидацию данных, отправку SMS‑кодов и обработку этапов авторизации.
 *
 * Основные функции модуля:
 * - координация процесса аутентификации через обработчики шагов;
 * - управление жизненным циклом сессий (создание, обновление, удаление, таймауты);
 * - валидация и поиск по телефонным номерам;
 * - генерация и отправка SMS‑кодов подтверждения;
 * - маршрутизация входящих сообщений по этапам аутентификации;
 * - интеграция с базой данных через Prisma для хранения и получения данных.
 *
 * @module AuthModule
 */
@Module({
  providers: [
    // Основной сервис модуля
    AuthService,

    // Сервисы бизнес‑логики
    SessionManagerService,
    IdMaxService,

    // Вспомогательные сервисы
    CodeGeneratorService,
    PhoneValidationService,

    // Обработчики событий
    AuthStartHandler,
    PhoneConfirmationHandler,
    MessageHandler,

    // Шаги авторизации
    PhoneStepHandler,
    FullnameStepHandler,
    CodeStepHandler,

    // Утилиты
    {
      provide: SessionTimeoutUtil,
      useFactory: (sessionManager: SessionManagerService) => {
        return new SessionTimeoutUtil(sessionManager, 300000); // 5 минут
      },
      inject: [SessionManagerService],
    },
    SmsSenderUtil,

    // Внешние зависимости
    PrismaService,
  ],
  exports: [AuthService],
})
export class AuthModule {}
