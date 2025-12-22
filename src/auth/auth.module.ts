import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionManagerService } from './session.manager.service';
import { PhoneValidationService } from './utils/phone.validation.service';
import { IdMaxService } from './idmax.service';
import { CodeGeneratorService } from './utils/code.generator.service';
import { AuthService } from './auth.service';

/**
 * Модуль аутентификации приложения.
 * 
 * Отвечает за организацию и управление компонентами, связанными с процессом аутентификации пользователей:
 * - управление сессиями;
 * - валидация телефонных номеров;
 * - работа с идентификаторами пользователей;
 * - генерация кодов подтверждения;
 * - основная логика аутентификации.
 * 
 * Предоставляет контроллеры для внешних HTTP‑запросов и экспортирует сервис аутентификации
 * для использования в других модулях приложения.
 * 
 * @module AuthModule
 */
@Module({
  imports: [],

    /**
   * Список провайдеров (сервисов), доступных в контексте данного модуля.
   * 
   * Включает:
   * - AuthService — основной сервис аутентификации;
   * - SessionManagerService — сервис управления сессиями;
   * - PhoneValidationService — сервис валидации телефонных номеров;
   * - IdMaxService — сервис работы с идентификаторами пользователей;
   * - CodeGeneratorService — сервис генерации кодов подтверждения;
   * - PrismaService — сервис доступа к базе данных.
   * 
   * @type {Function[]}
   */
  providers: [
    AuthService,
    SessionManagerService,
    PhoneValidationService,
    IdMaxService,
    CodeGeneratorService,
    PrismaService,
  ],

  controllers: [], 
  
  exports: [AuthService],
})
export class AuthModule {}
