import { Injectable } from '@nestjs/common';

@Injectable()
export class InitChatSessionDto {
  code?: number;

  step: 'awaiting_code' | 'awaiting_unit';

  timeoutId?: NodeJS.Timeout;

  unitId?: string;
}
