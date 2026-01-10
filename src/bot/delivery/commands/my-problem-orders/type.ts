export interface ProblemOrderResponse {
  orderNumber: string;
  handedOverToDeliveryAt: Date;
  typeOfOffense: null | string;
  expiration: null | number;
  courierComment: null | string;
  decisionManager: null | string;
  directorComment: null | string;
}
