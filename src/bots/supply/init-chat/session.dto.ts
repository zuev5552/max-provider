export class InitChatSessionDto {
  groupChatId?: number;
  step: 'awaiting_chat' | 'awaiting_unit' | 'completed';
  timeoutId?: NodeJS.Timeout;
  unitId?: string;
  unitName?: string;

  constructor() {
    this.step = 'awaiting_unit';
  }
}
