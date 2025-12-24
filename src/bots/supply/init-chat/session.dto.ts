/**
 * Данные сессии инициализации чата.
 * Хранит состояние процесса для конкретного пользователя.
 */
export class InitChatSessionDto {
  /** chatId группового чата (после добавления бота) */
  groupChatId?: number;

  /** Текущий шаг процесса */
  step: 'awaiting_chat' | 'awaiting_unit';
  timeoutId?: NodeJS.Timeout;
  unitId?: string;
  unitName?: string;

  constructor() {
    this.step = 'awaiting_unit';
  }
}
