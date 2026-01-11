/* eslint-disable perfectionist/sort-classes */
import { Injectable, Logger } from '@nestjs/common';

/** Сервис для управления сессиями диалогов с автоматической очисткой по таймауту.
 * Хранит состояния диалогов, orderId и связанные с ними таймеры очистки. */
@Injectable()
export class DeliverySessionService {
  // Map: ключ → объект с состоянием, orderId и таймером
  private sessions = new Map<number, { state: string; orderId: string; timer: NodeJS.Timeout }>();
  private readonly DIALOG_TIMEOUT = 30 * 60 * 1000; // 30 минут

  private logger = new Logger(DeliverySessionService.name);

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
   * Получает orderId из сессии по ключу.
   * @param {number} key - Уникальный идентификатор сессии
   * @returns {string | null} - orderId или null, если сессия не найдена или orderId не установлен
   */
  getOrderId(key: number): string | null {
    const session = this.sessions.get(key);
    return session?.orderId || null;
  }

  /**
   * Устанавливает состояние диалога и orderId, запускает таймер автоматической очистки.
   * Если для ключа уже существует сессия, предыдущий таймер останавливается.
   * @param {number} key - Уникальный идентификатор сессии
   * @param {string} state - Новое состояние диалога
   * @param {string} orderId - ID заказа, связанный с диалогом
   */
  set(key: number, state: string, orderId: string): void {
    // Удаляем старый таймер, если он был
    this.clearTimer(key);

    // Создаём новый таймер
    const timer = setTimeout(() => {
      this.delete(key);
      this.logger.log(`Диалог для ключа ${key} автоматически очищен (30 минут истекли)`);
    }, this.DIALOG_TIMEOUT);

    // Сохраняем состояние, orderId и таймер в одном объекте
    this.sessions.set(key, { state, orderId, timer });
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
