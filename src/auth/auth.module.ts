import { Module } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { CodeGeneratorService } from '../utils/code.generator.service';
import { PhoneValidationService } from '../utils/phone.validation.service';
import { AuthService } from './auth.service/auth.service';
import { AuthStartHandler } from './auth.service/handlers/auth-start.handler';
import { CodeStepHandler } from './auth.service/steps/code-step.handler';
import { MessageHandler } from './auth.service/handlers/message.handler';
import { ResendCodeHandler } from './auth.service/handlers/resend-code.handler';
import { IdMaxService } from './auth.service/idmax.service';
import { SessionManagerService } from './auth.service/session.manager.service';
import { FullnameStepHandler } from './auth.service/steps/fullname-step.handler';
import { PhoneStepHandler } from './auth.service/steps/phone-step.handler';
import { SessionTimeoutUtil } from './auth.service/utils/session-timeout.util';
import { SmsSenderUtil } from './auth.service/utils/sms-sender.util';

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
    MessageHandler,
    ResendCodeHandler,

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
  exports: [
    AuthService, // только основной сервис для экспорта
  ],
})
export class AuthModule {}
