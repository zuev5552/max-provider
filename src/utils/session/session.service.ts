/* eslint-disable perfectionist/sort-classes */
import { Injectable, Logger } from '@nestjs/common';

import { SessionType } from './type';

/** Сервис для управления сессиями диалогов с автоматической очисткой по таймауту.
 * Хранит состояния диалогов, orderId и связанные с ними таймеры очистки. */
@Injectable()
export class SessionService {
  private sessions = new Map<number, SessionType>();
  private readonly DIALOG_TIMEOUT = 30 * 60 * 1000; // 30 минут

  private logger = new Logger(SessionService.name);

  /**
   * Получает текущее состояние диалога по ключу.
   * @param {number} key - Уникальный идентификатор сессии (chatId или userId)
   * @returns {string | undefined} - Текущее состояние диалога или undefined, если сессия не найдена
   */
  get(key: number): SessionType | undefined {
    const session = this.sessions.get(key);
    return session;
  }

  /**
   * Устанавливает состояние диалога и orderId, запускает таймер автоматической очистки.
   * Если для ключа уже существует сессия, предыдущий таймер останавливается.
   * @param {number} key - Уникальный идентификатор сессии
   * @param {string} state - Новое состояние диалога
   * @param {string} orderId - ID заказа, связанный с диалогом
   */
  create(key: number, partial: Partial<SessionType>): void {
    const timer = setTimeout(() => {
      this.logger.log(`Диалог для ключа ${key} автоматически очищен (30 минут истекли)`);
    }, this.DIALOG_TIMEOUT);

    const createSession: SessionType = {
      ...partial,
      timer,
    };
    // Сохраняем сессию
    this.sessions.set(key, createSession);
  }

  update(key: number, partial: Partial<SessionType>): void {
    const currentSession = this.sessions.get(key);
    // Обновляем таймер
    this.clearTimer(key);
    const timer = setTimeout(() => {
      this.delete(key);
      this.logger.log(`Диалог для ключа ${key} автоматически очищен (30 минут истекли)`);
    }, this.DIALOG_TIMEOUT);

    const updatedSession: SessionType = {
      ...currentSession,
      ...partial,
      timer,
    };

    //Обновляем сессию
    this.sessions.set(key, updatedSession);
    this.logger.debug(`[session_updated] chatId: ${key}`);
  }

  /**
   * Полностью удаляет сессию диалога: останавливает таймер и очищает состояние.
   * Безопасный метод — не вызывает ошибок, если сессия не существует.
   * @param {number} key - Уникальный идентификатор сессии для удаления
   */
  delete(key: number): void {
    const session = this.sessions.get(key);
    if (session) {
      clearTimeout(session.timer); // Останавливаем таймер
    }
    this.sessions.delete(key); // Удаляем запись
  }

  /**
   * Останавливает таймер очистки для указанной сессии без удаления состояния.
   * Используется перед установкой нового таймера для предотвращения дублирования.
   * @param {number} key - Уникальный идентификатор сессии
   * @private
   */
  private clearTimer(key: number): void {
    const session = this.sessions.get(key);
    if (session) {
      clearTimeout(session.timer);
    }
  }

  /**
   * Принудительно очищает все активные сессии: останавливает все таймеры и удаляет состояния.
   * Используется при перезапуске приложения или в тестах для сброса состояния сервиса.
   */
  clearAll(): void {
    for (const session of this.sessions.values()) {
      clearTimeout(session.timer);
    }
    this.sessions.clear();
  }
}
