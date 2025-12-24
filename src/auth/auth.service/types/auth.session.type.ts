export interface AuthSession {
  step: 'awaiting_phone' | 'awaiting_fullname' | 'awaiting_code';
  phone?: string;
  fullname?: string;
  code?: number;
  possibleStaff?: Array<{
    id: string;
    firstName: string;
    lastName: string;
  }>;
  matchedStaff?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  createdAt: Date; // добавляем это поле
  timeoutId?: NodeJS.Timeout;
  attemptsCount: number;
  lastSmsSentAt?: number; // timestamp в миллисекундах
  lastResendRequestAt?: number; // timestamp в миллисекундах
}
