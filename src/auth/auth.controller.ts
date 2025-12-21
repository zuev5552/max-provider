import { Controller } from '@nestjs/common';
import { Bot } from '@maxhub/max-bot-api';
import { AuthService } from './auth.service';


@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}


  // Метод для подключения диалога к боту
  // Вызывается извне (например, в SupplyBotService)
  setupBotDialogue(bot: Bot): void {
    this.authService.setupAuthDialogue(bot);
  }
}
