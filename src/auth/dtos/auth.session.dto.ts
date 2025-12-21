import { Staff } from '@prisma/client';

export class AuthSessionDto {
  step: 'awaiting_phone' | 'awaiting_fullname' | 'awaiting_code';
  phone: string | null;
  fullname: string | null;
  code: number | null;
  possibleStaff: Staff[] | null;
  matchedStaff: Staff | null;
  createdAt: Date;
  
  // Добавляем поле для хранения ID таймера
  timeoutId?: NodeJS.Timeout; // может быть undefined или ID таймера
}
