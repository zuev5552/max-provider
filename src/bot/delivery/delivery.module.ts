import { Module } from '@nestjs/common';

import { FaqService } from './commands/faq.service';
import { PaymentQrCodeService } from './commands/qr-code.service';
import { DeliveryMenuService } from './delivery-menu.service';

@Module({
  providers: [DeliveryMenuService, FaqService, PaymentQrCodeService],
  exports: [DeliveryMenuService, FaqService, PaymentQrCodeService],
})
export class DeliveryModule {}
