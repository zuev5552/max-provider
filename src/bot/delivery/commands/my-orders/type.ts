/**
 * Интерфейс для представления данных заказа курьера
 */
export interface MyOrdersResponse {
  /** Дата и время поездки */
  handedOverToDeliveryAtLocal: Date;
  /** Номер заказа */
  orderNumber: string;
  /** Плановое время поездки в минутах */
  predictedDeliveryTime: number;
  /** Фактическое время поездки в минутах */
  deliveryTime: number;
  /** Рейтинг скорости по заказу */
  rating: number;
  /** Причина корректировки рейтинга (если есть) */
  causeCorrectRating?: string;
}
