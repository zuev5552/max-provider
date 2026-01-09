/* eslint-disable perfectionist/sort-classes */
import { Injectable, Logger } from '@nestjs/common';

/** Сервис для управления сессиями диалогов с автоматической очисткой по таймауту.
 * Хранит состояния диалогов и связанные с ними таймеры очистки.*/
@Injectable()
export class SessionStockService {
  // Один Map: ключ → объект с состоянием и таймером
  private sessions = new Map<number, { state: string; timer: NodeJS.Timeout }>();
  private readonly DIALOG_TIMEOUT = 30 * 60 * 1000; // 30 минут

  private logger = new Logger(SessionStockService.name);

  /**
   * Получает текущее состояние диалога по ключу.
   * @param {number} key - Уникальный идентификатор сессии (chatId или userId)
   * @returns {string | undefined} - Текущее состояние диалога или undefined, если сессия не найдена
   */
  get(key: number): string | undefined {
    const session = this.sessions.get(key);
    return session?.state;
  }

  /**
   * Устанавливает состояние диалога и запускает таймер автоматической очистки.
   * Если для ключа уже существует сессия, предыдущий таймер останавливается.
   * @param {number} key - Уникальный идентификатор сессии
   * @param {string} state - Новое состояние диалога
   */
  set(key: number, state: string): void {
    // Удаляем старый таймер, если он был
    this.clearTimer(key);

    // Создаём новый таймер
    const timer = setTimeout(() => {
      this.delete(key);
      this.logger.log(`Диалог для ключа ${key} автоматически очищен (30 минут истекли)`);
    }, this.DIALOG_TIMEOUT);

    // Сохраняем состояние и таймер в одном объекте
    this.sessions.set(key, { state, timer });
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
      // Не удаляем запись целиком — только останавливаем таймер,
      // Состояние остаётся, пока не будет вызван set/delete
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
