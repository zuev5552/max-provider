// utils/session/type.ts
export interface SessionType {
  state: string;
  orderId?: string;
  allowedCommands: string[]; // Разрешённые текстовые команды
  allowedCallbacks: string[]; // Разрешённые callback‑payload
  timer: NodeJS.Timeout;
  stepDescription?: string; // Текстовое описание шага для пользователя
}
