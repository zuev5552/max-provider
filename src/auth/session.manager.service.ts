import { Injectable } from '@nestjs/common';
import { AuthSessionDto } from './dtos/auth.session.dto';

@Injectable()
export class SessionManagerService {
  private sessions = new Map<number, AuthSessionDto>();

  create(chatId: number): void {
    this.sessions.set(chatId, {
      step: 'awaiting_phone',
      phone: null,
      fullname: null,
      code: null,
      possibleStaff: null,
      matchedStaff: null,
      createdAt: new Date(),
      chatId,
    });
  }

  get(chatId: number): AuthSessionDto | undefined {
    return this.sessions.get(chatId);
  }

  delete(chatId: number): void {
    this.sessions.delete(chatId);
  }

  update(chatId: number, partial: Partial<AuthSessionDto>): void {
    const session = this.get(chatId);
    if (session) {
      Object.assign(session, partial);
    }
  }
}
