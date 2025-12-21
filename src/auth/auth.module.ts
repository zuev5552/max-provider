import { Module } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionManagerService } from './session.manager.service';
import { PhoneValidationService } from './phone.validation.service';
import { IdMaxService } from './idmax.service';
import { CodeGeneratorService } from './code.generator.service';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

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

    /**
   * Список контроллеров, обрабатывающих HTTP‑запросы.
   * 
   * В модуле представлен один контроллер:
   * - AuthController — обрабатывает маршруты, связанные с аутентификацией.
   * 
   * @type {Function[]}
   */
  controllers: [AuthController], 
  
    /**
   * Список экспортируемых компонентов.
   * 
   * Модуль экспортирует:
   * - AuthService — чтобы другие модули могли использовать логику аутентификации.
   * 
   * @type {Function[]}
   */
  exports: [AuthService],
})
export class AuthModule {}
