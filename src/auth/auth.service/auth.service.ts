/* eslint-disable perfectionist/sort-classes */
import { Bot } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { AuthStartHandler } from './handlers/auth-start.handler';
import { MessageHandler } from './handlers/message.handler';
import { PhoneConfirmationHandler } from './handlers/phone-confirmation.handler';

/**
 * Сервис аутентификации для настройки обработчиков бота.
 * Отвечает за регистрацию всех обработчиков событий, связанных с процессом аутентификации.
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
   * Настраивает бота, регистрируя все необходимые обработчики событий.
   * Вызывает методы настройки для каждого из обработчиков:
   * - обработчик начала аутентификации;
   * - обработчик подтверждения телефона;
   * - обработчик общих сообщений.
   *
   * @param bot Экземпляр бота, для которого выполняется настройка обработчиков.
   *
   * @example
   * ```typescript
   * const authService = new AuthService(authStartHandler, messageHandler, phoneConfirmationHandler);
   * authService.setupBot(myBot);
   * ```
   */
  setupBot(bot: Bot): void {
    this.authStartHandler.handleAuthStart(bot);
    this.phoneConfirmationHandler.setup(bot);
    this.messageHandler.setup(bot);
  }
}
