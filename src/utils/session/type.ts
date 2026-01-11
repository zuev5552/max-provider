export interface SessionType {
  state?: string;
  timer: NodeJS.Timeout;
  orderId?: string;
}
