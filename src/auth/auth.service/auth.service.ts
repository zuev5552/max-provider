/* eslint-disable perfectionist/sort-classes */
import { Bot } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { AuthStartHandler } from './handlers/auth-start.handler';
import { MessageHandler } from './handlers/message.handler';
import { PhoneConfirmationHandler } from './handlers/phone-confirmation.handler';

/**
 * Сервис аутентификации пользователей в MAX‑боте.
 *
 * Централизует управление обработчиками этапов аутентификации:
 * - запуск процесса аутентификации;
 * - подтверждение телефонного номера;
 * - обработка общих сообщений в контексте аутентификации.
 *
 * @Injectable
 * @class AuthService
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authStartHandler: AuthStartHandler,
    private readonly messageHandler: MessageHandler,
    private readonly phoneConfirmationHandler: PhoneConfirmationHandler,
  ) {}

    /**
   * Настраивает бота, регистрируя все обработчики аутентификации.
   * Последовательно вызывает методы настройки для каждого обработчика, чтобы:
   * - зарегистрировать обработчик запуска аутентификации (`authStartHandler`);
   * - настроить обработку подтверждения номера телефона (`phoneConfirmationHandler`);
   * - подключить обработку общих сообщений в контексте аутентификации (`messageHandler`).
   *
   * Этот метод должен вызываться один раз при инициализации бота для полной
   * настройки функционала аутентификации.
   *
   * @param {Bot} bot — экземпляр бота MaxBot API, который будет настроен
   *   для обработки событий аутентификации. Все зарегистрированные обработчики
   *   будут привязаны к этому боту и реагировать на соответствующие события.
   *
   * @example
   * // Создание сервиса аутентификации с внедрёнными зависимостями
   * const authService = new AuthService(authStartHandler, messageHandler, phoneConfirmationHandler);
   *
   * // Настройка бота для работы с аутентификацией
   * authService.setupBot(bot);
   * // Теперь бот готов обрабатывать команды и сообщения, связанные с аутентификацией
   *
   * @returns {void}
   */
  setupBot(bot: Bot): void {
    this.authStartHandler.handleAuthStart(bot);
    this.phoneConfirmationHandler.setup(bot);
    this.messageHandler.setup(bot);
  }
}
