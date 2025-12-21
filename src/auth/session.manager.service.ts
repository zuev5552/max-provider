import { Injectable } from '@nestjs/common';
import { AuthSessionDto } from './dtos/auth.session.dto';

/**
 * Сервис управления сессиями аутентификации.
 *
 * Обеспечивает хранение, получение, обновление и удаление сессий пользователей
 * в процессе многоэтапной аутентификации через мессенджер.
 *
 * Использует Map для хранения сессий, где ключом является chatId.
 *
 * @Injectable
 * @class SessionManagerService
 */
@Injectable()
export class SessionManagerService {
  /**
   * Хранилище сессий аутентификации.
   *
   * Ключ — chatId (числовой идентификатор чата), значение — объект сессии AuthSessionDto.
   * @private
   * @type {Map<number, AuthSessionDto>}
   */
  private sessions = new Map<number, AuthSessionDto>();

  /**
   * Создаёт новую сессию аутентификации для указанного чата.
   *
   * Устанавливает начальное состояние сессии:
   * - этап: ожидание ввода телефона ('awaiting_phone');
   * - остальные поля инициализируются значениями по умолчанию.
   *
   * @param {number} chatId - идентификатор чата, для которого создаётся сессия
   * @returns {void}
   *
   * @example
   * sessionManagerService.create(12345);
   */
  create(chatId: number): void {
    this.sessions.set(chatId, {
      step: 'awaiting_phone',
      phone: null,
      fullname: null,
      code: undefined,
      possibleStaff: null,
      matchedStaff: null,
      createdAt: new Date(),
      timeoutId: undefined,
      attemptsCount: 0,
    });
  }

    /**
   * Получает сессию аутентификации по идентификатору чата.
   *
   * @param {number} chatId - идентификатор чата
   * @returns {AuthSessionDto | undefined} - объект сессии, если найден,
   *   или undefined, если сессия отсутствует
   *
   * @example
   * const session = sessionManagerService.get(12345);
   * if (session) {
   *   // Сессия найдена
   * }
   */
  get(chatId: number): AuthSessionDto | undefined {
    return this.sessions.get(chatId);
  }

    /**
   * Удаляет сессию аутентификации для указанного чата.
   *
   * @param {number} chatId - идентификатор чата, для которого удаляется сессия
   * @returns {void}
   *
   * @example
   * sessionManagerService.delete(12345);
   */
  delete(chatId: number): void {
    this.sessions.delete(chatId);
  }

    /**
   * Обновляет поля существующей сессии аутентификации.
   *
   * Применяет частичное обновление (Partial) к объекту сессии.
   * Если сессия не найдена, операция игнорируется.
   *
   * @param {number} chatId - идентификатор чата, для которого обновляется сессия
   * @param {Partial<AuthSessionDto>} partial - объект с полями для обновления
   * @returns {void}
   *
   * @example
   * sessionManagerService.update(12345, { step: 'awaiting_code', code: 1234 });
   */
  update(chatId: number, partial: Partial<AuthSessionDto>): void {
    const session = this.get(chatId);
    if (session) {
      Object.assign(session, partial);
    }
  }
}
