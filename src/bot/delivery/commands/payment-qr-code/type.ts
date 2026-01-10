export type CouriersOnShift = {
  id: string;
  clockInAt: string;
  clockInAtLocal: string;
  scheduledClockInAt: string;
  scheduledClockInAtLocal: string;
  positionId: string;
  positionName: string;
  scheduleId: string;
  unitId: string;
  unitName: string;
  deliveredOrdersCount: number;
  lateOrdersCount: number;
  cashFromOrders: number;
};
