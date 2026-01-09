import { Module } from '@nestjs/common';

import { EventDeduplicatorService } from './bot/event-deduplicator.service';
import { CodeGeneratorService } from './core/code.generator.service';
import { PhoneValidationService } from './validation/phone.validation.service';

@Module({
  providers: [EventDeduplicatorService, PhoneValidationService, CodeGeneratorService],
  exports: [EventDeduplicatorService, PhoneValidationService, CodeGeneratorService],
})
export class UtilsModule {}
