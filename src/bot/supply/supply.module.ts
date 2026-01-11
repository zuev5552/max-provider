import { Module } from '@nestjs/common';

import { ShowChangeStockService } from './show-stock/show-change-stock.service';
import { ShowStockService } from './show-stock/show-stock.service';
import { StockAlertCallbackService } from './stok-alert-callback/low-stock-callback.service';
import { SupplyMenuService } from './supply-menu.service';

@Module({
  providers: [ShowChangeStockService, ShowStockService, StockAlertCallbackService, SupplyMenuService],
  exports: [ShowChangeStockService, ShowStockService, StockAlertCallbackService, SupplyMenuService],
})
export class SupplyModule {}
