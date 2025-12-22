import { Injectable } from '@nestjs/common';

import { InitChatSessionDto } from './session.dto';

@Injectable()
export class SessionManagerService {
  private sessions = new Map<string, InitChatSessionDto>();

  create(chatId: string, userId: string): void {
    const key = `${chatId}:${userId}`;
    this.sessions.set(key, {
      step: 'awaiting_unit',
      code: undefined,
      timeoutId: undefined,
      unitId: undefined,
    });
  }

  delete(chatId: string, userId: string): void {
    const key = `${chatId}:${userId}`;
    this.sessions.delete(key);
  }

  get(chatId: string, userId: string): InitChatSessionDto | undefined {
    const key = `${chatId}:${userId}`;
    return this.sessions.get(key);
  }

  update(chatId: string, userId: string, partial: Partial<InitChatSessionDto>): boolean {
    const session = this.get(chatId, userId);
    if (!session) {
      return false;
    }
    Object.assign(session, partial);
    return true;
  }
}
