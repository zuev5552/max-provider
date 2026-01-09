// Интерфейс для типизации данных из SQL‑запроса
export interface StockData {
  id: number;
  name: string;
  unitId: string;
  unitName: string;
  quantity: number;
  measurementUnit: string;
  daysUntilBalanceRunsOut: null | number;
  calculatedAt: Date | string;
  calculatedAtLocal: Date | string;
}
