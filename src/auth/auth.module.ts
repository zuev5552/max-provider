import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionManagerService } from './session.manager.service';
import { PhoneValidationService } from './phone.validation.service';
import { IdMaxService } from './idmax.service';
import { CodeGeneratorService } from './code.generator.service';
import { AuthService } from './auth.service';

@Module({
  imports: [],
  providers: [
    AuthService,
    SessionManagerService,
    PhoneValidationService,
    IdMaxService,
    CodeGeneratorService,
    PrismaService, // или импортируйте из общего модуля
  ],
  exports: [AuthService],
})
export class AuthModule {}
