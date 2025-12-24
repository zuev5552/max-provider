import { Injectable, Logger } from '@nestjs/common';
import { SessionManagerService } from '../session.manager.service';

@Injectable()
export class SessionTimeoutUtil {
  private readonly activeTimeouts = new Map<number, NodeJS.Timeout>();
  private readonly logger = new Logger(SessionTimeoutUtil.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly sessionTimeout: number,
  ) {}

  clearTimeout(chatId: number): void {
    const timeout = this.activeTimeouts.get(chatId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(chatId);
    } else {
      this.logger.warn(`Попытка очистить несуществующий таймер для chatId ${chatId}`);
    }
  }

  setupTimeout(chatId: number): void {
    if (!this.sessionManager) {
      this.logger.error('SessionManager не инициализирован в SessionTimeoutUtil');
      return;
    }

    // Очищаем предыдущий таймер, если он есть
    const existingTimeout = this.activeTimeouts.get(chatId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.activeTimeouts.delete(chatId);
    }

    const timeoutId = setTimeout(() => {
      if (this.sessionManager.get(chatId)) {
        this.sessionManager.delete(chatId);
        this.logger.log(`Сессия ${chatId} удалена по таймауту`);
      }
      this.activeTimeouts.delete(chatId); // Удаляем из отслеживания
    }, this.sessionTimeout);

    // Сохраняем ID таймера локально, не передаём в sessionManager
    this.activeTimeouts.set(chatId, timeoutId);
  }
}
