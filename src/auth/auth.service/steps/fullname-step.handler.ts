import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { IdMaxService } from '../idmax.service';
import { SessionManagerService } from '../session.manager.service';
import { MESSAGES } from '../utils/messages.constants';
import { SmsSenderUtil } from '../utils/sms-sender.util';
import { safeReply } from '@/utils/safe-reply.util';

@Injectable()
export class FullnameStepHandler {
  private readonly logger = new Logger(FullnameStepHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly idMaxService: IdMaxService,
    private readonly smsSender: SmsSenderUtil,
  ) {}

  async handle(ctx: Context, chatId: number, inputText: string): Promise<void> {
    const fullname = inputText.toLowerCase();
    const session = this.sessionManager.get(chatId);

    if (!session) {
      return; // сессия исчезла — выходим
    }

    const matchedStaff = session.possibleStaff?.find(
      staff => `${staff.firstName} ${staff.lastName}`.toLowerCase() === fullname,
    );

    if (!matchedStaff) {
      await safeReply(ctx, MESSAGES.FULLNAME_NOT_FOUND, this.logger);
      return;
    }

    const hasIdMax = await this.idMaxService.hasIdMax(matchedStaff.id);
    if (hasIdMax) {
      await safeReply(ctx, MESSAGES.ALREADY_REGISTERED(matchedStaff.firstName, matchedStaff.lastName), this.logger);
      this.sessionManager.delete(chatId);
      this.logger.log(`[already_registered] Номер привязан к staffId ${matchedStaff.id} для chatId: ${chatId}`);
      return;
    }

    const smsSent = await this.smsSender.sendAuthCode(chatId, session.phone!);

    if (smsSent) {
      this.sessionManager.update(chatId, {
        fullname: inputText,
        matchedStaff,
        step: 'awaiting_code',
      });
      await safeReply(ctx, MESSAGES.SMS_SENT(session.phone!), this.logger);
    } else {
      await safeReply(ctx, MESSAGES.SMS_SEND_ERROR, this.logger);
      this.sessionManager.delete(chatId);
    }
  }
}
