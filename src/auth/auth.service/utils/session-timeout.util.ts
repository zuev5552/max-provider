import { Injectable, Logger } from '@nestjs/common';

import { SessionManagerService } from '../session.manager.service';

/**
 * Утилита управления таймаутами сессий аутентификации.
 *
 * Отвечает за:
 * - установку таймера для автоматической очистки сессии по истечении заданного времени;
 * - очистку ранее установленных таймеров (например, при продлении сессии);
 * - отслеживание активных таймеров по `chatId`;
 * - логирование событий (установка, очистка, удаление сессии по таймауту).
 *
 * Используется для предотвращения накопления устаревших сессий в памяти.
 *
 * @Injectable
 * @class SessionTimeoutUtil
 */
@Injectable()
export class SessionTimeoutUtil {
  /**
   * Хранилище активных таймеров, где ключ — `chatId`, значение — объект таймера Node.js (`NodeJS.Timeout`).
   * Позволяет отслеживать и управлять таймерами для каждой сессии отдельно.
   * @private
   * @type {Map<number, NodeJS.Timeout>}
   */
  private readonly activeTimeouts = new Map<number, NodeJS.Timeout>();
  private readonly logger = new Logger(SessionTimeoutUtil.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly sessionTimeout: number,
  ) {}

  /**
   * Очищает ранее установленный таймер для указанной сессии.
   * Если таймер для `chatId` существует, он отменяется с помощью `clearTimeout()`,
   * а запись удаляется из внутреннего хранилища `activeTimeouts`.
   * Если таймера для `chatId` нет, логируется предупреждение.
   *
   * Используется, например, при продлении сессии — старый таймер нужно отменить,
   * перед установкой нового.
   *
   * @param {number} chatId — идентификатор чата/пользователя, для которого нужно очистить таймер
   *
   * @returns {void}
   */
  clearTimeout(chatId: number): void {
    const timeout = this.activeTimeouts.get(chatId);
    if (timeout) {
      clearTimeout(timeout);
      this.activeTimeouts.delete(chatId);
    } else {
      this.logger.warn(`Попытка очистить несуществующий таймер для chatId ${chatId}`);
    }
  }

  /**
   * Устанавливает новый таймер для автоматической очистки сессии.
   * Выполняет следующие шаги:
   * 1. Проверяет инициализацию `sessionManager`. Если не инициализирован — логирует ошибку и выходит.
   * 2. Очищает предыдущий таймер для этого `chatId` (если был установлен).
   * 3. Создаёт новый таймер с помощью `setTimeout()`, который:
   *    - проверяет существование сессии по `chatId` через `sessionManager.get()`;
   *    - если сессия существует, удаляет её через `sessionManager.delete()` и логирует событие;
   *    - удаляет запись о таймере из `activeTimeouts` после выполнения.
   * 4. Сохраняет ID нового таймера в `activeTimeouts` для дальнейшего управления.
   *
   * Таймер запускается на время, заданное в `sessionTimeout` (в мс).
   *
   * @param {number} chatId — идентификатор чата/пользователя, для которого устанавливается таймер
   *
   * @returns {void}
   */
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
