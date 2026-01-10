export interface PremiumPaymentResponse {
  amount: string;
  namePremium: string;
  datePremium: Date;
  formattedDate: string; // если используется для группировки
}
