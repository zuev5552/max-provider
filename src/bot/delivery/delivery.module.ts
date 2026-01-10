import { Module } from '@nestjs/common';

import { FaqService } from './commands/faq.service';
import { MyOrdersService } from './commands/my-orders/my-orders.service';
import { PaymentQrCodeService } from './commands/qr-code.service';
import { DeliveryMenuService } from './delivery-menu.service';
import { UtilsModule } from '@/utils/utils.module';

@Module({
  providers: [DeliveryMenuService, FaqService, PaymentQrCodeService, MyOrdersService],
  exports: [DeliveryMenuService, FaqService, PaymentQrCodeService, MyOrdersService],
  imports: [UtilsModule],
})
export class DeliveryModule {}
