/* eslint-disable perfectionist/sort-classes */
import { Injectable } from '@nestjs/common';

@Injectable()
export class WelcomeMessageService {
  /**
   * Возвращает приветственное сообщение для бота.
   * @returns {string} Текст приветственного сообщения
   */
  getWelcomeMessage(): string {
    return `
Привет я бот DodoPizza.
Давайте вначале проверим регистрацию вашего аккаунта в системе.
    `.trim();
  }

  /**
   * Возвращает краткое приветственное сообщение (альтернативный вариант).
   * @param username Имя пользователя (опционально)
   * @returns {string} Персонализированное приветственное сообщение
   */
  getShortWelcomeMessage(username?: string): string {
    const baseMessage = 'Привет! Я бот по сырью.';
    if (username) {
      return `${baseMessage} Рад видеть тебя, ${username}!`;
    }
    return baseMessage;
  }
}
