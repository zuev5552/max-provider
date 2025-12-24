import { Injectable, Logger } from '@nestjs/common';

import { AuthSession } from './types/auth.session.type';

/**
 * Сервис управления сессиями аутентификации пользователей.
 *
 * Отвечает за создание, хранение, обновление и удаление сессий,
 * а также за очистку устаревших записей. Каждая сессия связана с chatId
 * и содержит текущее состояние процесса авторизации.
 *
 * @class SessionManagerService
 */
@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);
  private sessions = new Map<number, AuthSession>();

  /**
   * Очищает устаревшие сессии, превысившие заданный возраст.
   *
   * Перебирает все сессии, сравнивает время их создания с текущим моментом
   * и удаляет те, что старше указанного порога.
   *
   * @param {number} [maxAgeMs=86400000] — максимальный возраст сессии в миллисекундах
   * (по умолчанию — 24 часа)
   * @returns {void}
   */
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

  /**
   * Создаёт новую сессию аутентификации для указанного chatId.
   *
   * Инициализирует сессию со стандартным набором полей и начальным шагом
   * `awaiting_phone`. Сохраняет запись в хранилище.
   *
   * @param {number} chatId — идентификатор чата/пользователя, для которого создаётся сессия
   * @returns {void}
   */
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

  /**
   * Удаляет сессию по указанному chatId.
   *
   * Перед удалением очищает таймер сессии (если он установлен),
   * затем удаляет запись из хранилища и логирует действие.
   *
   * @param {number} chatId — идентификатор сессии для удаления
   * @returns {void}
   */
  delete(chatId: number): void {
    this.clearTimeout(chatId);

    if (this.sessions.has(chatId)) {
      this.sessions.delete(chatId);
      this.logger.debug(`[session_deleted] chatId: ${chatId}`);
    }
  }

  /**
   * Получает копию сессии по указанному chatId.
   *
   * Возвращает неизменяемую копию данных сессии, чтобы предотвратить
   * прямое изменение внутреннего состояния хранилища.
   *
   * @param {number} chatId — идентификатор запрашиваемой сессии
   * @returns {AuthSession | undefined} копия сессии или `undefined`, если сессия не найдена
   */
  get(chatId: number): AuthSession | undefined {
    const session = this.sessions.get(chatId);
    return session ? { ...session } : undefined;
  }

  /**
   * Возвращает текущее количество активных сессий.
   *
   * Полезен для мониторинга нагрузки и отладки.
   *
   * @returns {number} количество сессий в хранилище (`Map.size`)
   */
  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Обновляет данные существующей сессии.
   *
   * Если сессия не найдена, записывает предупреждение в лог.
   * В противном случае применяет частичные изменения к текущей сессии,
   * сохраняет обновлённую версию и логирует внесённые изменения
   * (исключая поле `timeoutId`).
   *
   * @param {number} chatId — идентификатор сессии для обновления
   * @param {Partial<AuthSession>} partial — объект с полями, которые нужно обновить
   * @returns {void}
   */
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

  /**
   * Вспомогательный метод для очистки таймера сессии.
   *
   * Если у сессии установлен `timeoutId`, отменяет соответствующий таймер
   * через `clearTimeout` и сбрасывает поле `timeoutId` в данных сессии.
   * Используется перед удалением сессии, чтобы избежать утечек памяти.
   *
   * @private
   * @param {number} chatId — идентификатор сессии, таймер которой нужно очистить
   * @returns {void}
   */
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
