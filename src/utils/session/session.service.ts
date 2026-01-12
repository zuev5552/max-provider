/* eslint-disable perfectionist/sort-classes */
import { Injectable, Logger } from '@nestjs/common';

import { SessionType } from './type';

/**
 * Сервис управления сессиями диалогов с пользователями.
 * Отвечает за:
 * - создание, обновление и удаление сессий;
 * - управление таймаутами сессий (автоочистка через 30 минут);
 * - проверку разрешений на команды и callback‑payload;
 * - получение описаний шагов диалога.
 */
@Injectable()
export class SessionService {
  private sessions = new Map<number, SessionType>();
  private readonly DIALOG_TIMEOUT = 30 * 60 * 1000;
  private logger = new Logger(SessionService.name);

  /**
   * Получает сессию пользователя по идентификатору.
   * @param key Уникальный идентификатор сессии (обычно ID пользователя)
   * @returns Объект сессии или undefined, если сессия не найдена
   */
  get(key: number): SessionType | undefined {
    return this.sessions.get(key);
  }

  /**
   * Создаёт новую сессию диалога для пользователя.
   * При наличии существующей сессии — удаляет её перед созданием новой.
   * Устанавливает таймер автоматической очистки (30 минут).
   * @param key Уникальный идентификатор сессии
   * @param partial Частичные данные для инициализации сессии
   */
  create(key: number, partial: Partial<SessionType>): void {
    this.delete(key);

    const timer = setTimeout(() => this.delete(key), this.DIALOG_TIMEOUT);
    const state = partial.state || 'initial';

    const { allowedCommands, allowedCallbacks } = this.getPermissionsByState(state);
    const stepDescription = partial.stepDescription || this.getDefaultStepDescription(state);

    const session: SessionType = {
      state,
      orderId: partial.orderId,
      allowedCommands: partial.allowedCommands || allowedCommands,
      allowedCallbacks: partial.allowedCallbacks || allowedCallbacks,
      timer,
      stepDescription,
    };

    this.sessions.set(key, session);
    this.logger.debug(`[session_created] chatId: ${key}, state: ${state}`);
  }

  /**
   * Обновляет существующую сессию и сбрасывает таймер очистки.
   * Если сессии нет — ничего не делает.
   * @param key Уникальный идентификатор сессии
   * @param partial Данные для обновления сессии
   */
  update(key: number, partial: Partial<SessionType>): void {
    const currentSession = this.sessions.get(key);
    if (!currentSession) return;

    this.clearTimer(key);

    const timer = setTimeout(() => this.delete(key), this.DIALOG_TIMEOUT);

    const updatedSession: SessionType = {
      ...currentSession,
      ...partial,
      timer,
    };

    this.sessions.set(key, updatedSession);
    this.logger.debug(`[session_updated] chatId: ${key}, state: ${updatedSession.state}`);
  }

  /**
   * Удаляет сессию пользователя: останавливает таймер и очищает состояние.
   * @param key Уникальный идентификатор сессии
   */
  delete(key: number): void {
    const session = this.sessions.get(key);
    if (session) clearTimeout(session.timer);
    this.sessions.delete(key);
    this.logger.debug(`[session_deleted] chatId: ${key}`);
  }

  /** Полностью очищает все активные сессии: останавливает таймеры и удаляет состояния. */
  clearAll(): void {
    for (const session of this.sessions.values()) {
      clearTimeout(session.timer);
    }
    this.sessions.clear();
    this.logger.debug('[sessions_cleared] Все сессии очищены');
  }

  /**
   * Проверяет, разрешена ли текстовая команда для текущей сессии.
   * @param session Текущая сессия пользователя
   * @param command Текстовая команда (например, '/cancel')
   * @returns true, если команда разрешена, иначе false
   */
  isCommandAllowed(session: SessionType, command: string): boolean {
    return session.allowedCommands?.includes(command) || false;
  }

  /**
   * Проверяет, разрешён ли callback‑payload для текущей сессии.
   * @param session Текущая сессия пользователя
   * @param payload Callback‑payload (например, 'photo_yes')
   * @returns true, если payload разрешён, иначе false
   */
  isCallbackAllowed(session: SessionType, payload: string): boolean {
    return session.allowedCallbacks?.includes(payload) || false;
  }

  /**
   * Останавливает таймер очистки для указанной сессии без удаления состояния.
   * @param key Уникальный идентификатор сессии
   */
  private clearTimer(key: number): void {
    const session = this.sessions.get(key);
    if (session) clearTimeout(session.timer);
  }

  /**
   * Возвращает стандартные разрешения (команды и callback‑payload) для заданного состояния.
   * @param state Идентификатор состояния диалога (например, 'awaiting_itemName')
   * @returns Объект с разрешёнными командами и callback‑payload
   */
  private getPermissionsByState(state: string): {
    allowedCommands: string[];
    allowedCallbacks: string[];
  } {
    const permissions = {
      awaiting_itemName: {
        allowedCommands: ['/cancel'],
        allowedCallbacks: [],
      },
      waiting_courier_reply: {
        allowedCommands: ['/cancel'],
        allowedCallbacks: ['photo_yes', 'photo_no', 'cancel'],
      },
      awaiting_photo_from_courier: {
        allowedCommands: ['/cancel'],
        allowedCallbacks: [],
      },
    };
    return (
      permissions[state] || {
        allowedCommands: ['/cancel'],
        allowedCallbacks: [],
      }
    );
  }

  /**
   * Возвращает стандартное текстовое описание шага диалога для заданного состояния.
   * @param state Идентификатор состояния диалога
   * @returns Текстовое описание шага для отображения пользователю
   */
  private getDefaultStepDescription(state: string): string {
    const descriptions = {
      waiting_courier_reply: 'Ожидание вашего комментария по заказу',
      awaiting_photo_from_courier: 'Ожидание фотодоказательств (максимум 3 фотографии)',
      awaiting_itemName: 'Ждём наименование сырья',
    };
    return descriptions[state] || 'Завершите текущий этап диалога';
  }
}
