export interface LowStockCallbackData {
  type: 'lowStock';
  createdDateUtc: string; // YYYY-MM-DD
  unitId: string;
  itemId: string;
  reason: string;
}
