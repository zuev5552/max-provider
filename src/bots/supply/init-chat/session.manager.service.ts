import { Injectable } from '@nestjs/common';

import { InitChatSessionDto } from './session.dto';

/**
 * Сервис управления сессиями пользователей.
 * Обеспечивает:
 * - Создание/удаление сессий
 * - Автоматическое удаление по таймауту
 * - Обновление данных сессии
 */
@Injectable()
export class SessionManagerService {
  /** Время жизни сессии в мс (1 час) */
  private readonly SESSION_TIMEOUT = 60 * 60 * 1000; // 1 час

  /** Хранилище сессий: userId → данные сессии */
  private sessions = new Map<number, InitChatSessionDto>();

  /**
   * Создаёт новую сессию для пользователя.
   * Устанавливает начальный шаг и таймер автоудаления.
   * @param userId ID пользователя
   */
  create(userId: number): void {
    this.sessions.set(userId, {
      step: 'awaiting_unit',
    });
    this.setupTimeout(userId);
  }

  /**
   * Удаляет сессию пользователя.
   * Очищает таймер, если он установлен.
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
   * Получает данные сессии по ID пользователя.
   * @param userId ID пользователя
   * @returns Объект сессии или undefined, если сессия не найдена
   */
  get(userId: number): InitChatSessionDto | undefined {
    return this.sessions.get(userId);
  }

  /**
   * Обновляет данные сессии.
   * Перезапускает таймер автоудаления.
   * @param userId ID пользователя
   * @param data Частичные данные для обновления сессии
   * @returns true, если сессия найдена и обновлена; false — если сессия отсутствует
   */
  update(userId: number, data: Partial<InitChatSessionDto>): boolean {
    const session = this.get(userId);
    if (!session) return false;

    Object.assign(session, data);
    this.setupTimeout(userId);
    return true;
  }

  /**
   * Устанавливает/перезапускает таймер автоудаления сессии.
   * Очистка предыдущего таймера (если есть).
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
