import { Injectable, Logger } from '@nestjs/common';

import { AuthSession } from './types/auth.session.type';

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);
  private sessions = new Map<number, AuthSession>();

  cleanupExpiredSessions(maxAgeMs: number = 24 * 60 * 60 * 1000): void {
    const now = Date.now();
    Array.from(this.sessions.entries())
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .filter(([_, session]) => now - session.createdAt.getTime() > maxAgeMs)
      .forEach(([chatId]) => {
        this.delete(chatId);
        this.logger.log(`[session_expired] Удалена устаревшая сессия chatId: ${chatId}`);
      });
  }

  create(chatId: number): void {
    const newSession: AuthSession = {
      step: 'awaiting_phone',
      phone: undefined,
      fullname: undefined,
      code: undefined,
      possibleStaff: undefined,
      matchedStaff: undefined,
      createdAt: new Date(),
      timeoutId: undefined, // Будет управляться извне
      attemptsCount: 0,
      lastSmsSentAt: undefined,
      lastResendRequestAt: undefined,
    };

    this.sessions.set(chatId, newSession);
    this.logger.debug(`[session_created] chatId: ${chatId}`);
  }

  delete(chatId: number): void {
    // Перед удалением очищаем таймер, если он существует
    this.clearTimeout(chatId);

    if (this.sessions.has(chatId)) {
      this.sessions.delete(chatId);
      this.logger.debug(`[session_deleted] chatId: ${chatId}`);
    }
  }

  get(chatId: number): AuthSession | undefined {
    const session = this.sessions.get(chatId);
    return session ? { ...session } : undefined;
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  update(chatId: number, partial: Partial<AuthSession>): void {
    const currentSession = this.sessions.get(chatId);

    if (!currentSession) {
      this.logger.warn(`[session_not_found] chatId: ${chatId} для обновления`);
      return;
    }

    // Создаём копию partial без timeoutId для логирования
    const logData = { ...partial };
    delete logData.timeoutId;

    const updatedSession: AuthSession = {
      ...currentSession,
      ...partial,
    };

    this.sessions.set(chatId, updatedSession);
    this.logger.debug(`[session_updated] chatId: ${chatId}, изменения: ${JSON.stringify(logData)}`);
  }

  // Вспомогательный метод для очистки таймера
  private clearTimeout(chatId: number): void {
    const session = this.sessions.get(chatId);
    if (session?.timeoutId) {
      clearTimeout(session.timeoutId);
      // Очищаем поле в сессии
      const updatedSession = { ...session, timeoutId: undefined };
      this.sessions.set(chatId, updatedSession);
    }
  }
}
