import { Module } from '@nestjs/common';

import { SessionStockService } from './show-stock/session-stock.service';
import { ShowChangeStockService } from './show-stock/show-change-stock.service';
import { ShowStockService } from './show-stock/show-stock.service';
import { StockAlertCallbackService } from './stok-alert-callback/low-stock-callback.service';
import { SupplyMenuService } from './supply-menu.service';

@Module({
  providers: [
    SessionStockService,
    ShowChangeStockService,
    ShowStockService,
    StockAlertCallbackService,
    SupplyMenuService,
  ],
  exports: [
    SessionStockService,
    ShowChangeStockService,
    ShowStockService,
    StockAlertCallbackService,
    SupplyMenuService,
  ],
})
export class SupplyModule {}
