import { Injectable } from '@nestjs/common';

import { InitChatSessionDto } from './session.dto';

@Injectable()
export class SessionManagerService {
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000; // 1 час
  private sessions = new Map<number, InitChatSessionDto>();

  /**
   * Создать сессию по userId
   * @param userId ID пользователя
   */
  create(userId: number): void {
    this.sessions.set(userId, {
      step: 'awaiting_unit',
    });
    this.setupTimeout(userId);
  }

  /**
   * Удалить сессию по userId
   * @param userId ID пользователя
   */
  delete(userId: number): void {
    const session = this.sessions.get(userId);

    if (session?.timeoutId) {
      clearTimeout(session.timeoutId);
    }

    this.sessions.delete(userId);
  }

  /**
   * Получить сессию по userId
   * @param userId ID пользователя
   * @returns Сессия или undefined
   */
  get(userId: number): InitChatSessionDto | undefined {
    return this.sessions.get(userId);
  }

  /**
   * Обновить сессию (перезапускает таймер)
   * @param userId ID пользователя
   * @param data Частичные данные для обновления
   * @returns true, если сессия найдена и обновлена
   */
  update(userId: number, data: Partial<InitChatSessionDto>): boolean {
    const session = this.get(userId);
    if (!session) return false;

    Object.assign(session, data);
    this.setupTimeout(userId);
    return true;
  }

  /**
   * Установить/перезапустить таймер автоудаления
   * @param userId ID пользователя
   */
  private setupTimeout(userId: number): void {
    const session = this.sessions.get(userId);
    if (!session) return;

    // Очистить предыдущий таймер
    if (session.timeoutId) {
      clearTimeout(session.timeoutId);
    }

    // Установить новый таймер
    const timeoutId = setTimeout(() => {
      this.sessions.delete(userId);
      console.log(`Сессия userId=${userId} удалена по таймауту`);
    }, this.SESSION_TIMEOUT);

    session.timeoutId = timeoutId;
  }
}
