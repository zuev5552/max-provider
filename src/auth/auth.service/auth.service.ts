/* eslint-disable perfectionist/sort-classes */
import { Bot } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { AuthStartHandler } from './handlers/auth-start.handler';
import { MessageHandler } from './handlers/message.handler';
import { ResendCodeHandler } from './handlers/resend-code.handler';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly authStartHandler: AuthStartHandler,
    private readonly messageHandler: MessageHandler,
    private readonly resendCodeHandler: ResendCodeHandler,
  ) {}

  setupBot(bot: Bot): void {
    this.authStartHandler.setup(bot);
    this.resendCodeHandler.setup(bot);
    this.messageHandler.setup(bot);
  }
}
