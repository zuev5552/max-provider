import { Global, Module } from '@nestjs/common';

import { EventDeduplicatorService } from './bot/event-deduplicator.service';
import { MessageChunkService } from './bot/message-chunk.service';
import { CodeGeneratorService } from './core/code.generator.service';
import { SessionService } from './session/session.service';
import { PhoneValidationService } from './validation/phone.validation.service';

@Global()
@Module({
  providers: [
    EventDeduplicatorService,
    PhoneValidationService,
    CodeGeneratorService,
    MessageChunkService,
    SessionService,
  ],
  exports: [
    EventDeduplicatorService,
    PhoneValidationService,
    CodeGeneratorService,
    MessageChunkService,
    SessionService,
  ],
})
export class UtilsModule {}
