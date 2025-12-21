export type Session = {
  step: 'awaiting_phone' | 'awaiting_code';
  phone: string | null;
  code: number | null;
  createdAt: Date;
  chatId: number | null;
  attempts: number; // счётчик попыток ввода кода
};
