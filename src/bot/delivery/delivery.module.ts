import { Module } from '@nestjs/common';

import { FaqService } from './commands/faq.service';
import { MyOrdersService } from './commands/my-orders/my-orders.service';
import { MyProblemOrdersService } from './commands/my-problem-orders/my-problem-orders.service';
import { CourierPremiumPaymentsService } from './commands/my-salary/my-salary.service';
import { PaymentQrCodeService } from './commands/payment-qr-code/qr-code.service';
import { DeliveryMenuService } from './delivery-menu.service';
import { UtilsModule } from '@/utils/utils.module';

@Module({
  providers: [
    DeliveryMenuService,
    FaqService,
    PaymentQrCodeService,
    MyOrdersService,
    MyProblemOrdersService,
    CourierPremiumPaymentsService,
  ],
  exports: [
    DeliveryMenuService,
    FaqService,
    PaymentQrCodeService,
    MyOrdersService,
    MyProblemOrdersService,
    CourierPremiumPaymentsService,
  ],
  imports: [UtilsModule],
})
export class DeliveryModule {}
