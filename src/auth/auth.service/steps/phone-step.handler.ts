import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { IdMaxService } from '../idmax.service';
import { SessionManagerService } from '../session.manager.service';
import { MESSAGES } from '../utils/messages.constants';
import { SmsSenderUtil } from '../utils/sms-sender.util';
import { PhoneValidationService } from '@/utils/phone.validation.service';
import { safeReply } from '@/utils/safe-reply.util';

@Injectable()
export class PhoneStepHandler {
  private readonly logger = new Logger(PhoneStepHandler.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly phoneValidator: PhoneValidationService,
    private readonly idMaxService: IdMaxService,
    private readonly smsSender: SmsSenderUtil,
  ) {}

  async handle(ctx: Context, chatId: number, inputText: string): Promise<void> {
    if (!this.phoneValidator.isValidPhone(inputText)) {
      await safeReply(ctx, MESSAGES.PHONE_INVALID, this.logger);
      return;
    }

    const staffList = await this.phoneValidator.findStaffByPhone(inputText.replace('+', ''));

    if (staffList.length === 0) {
      await safeReply(ctx, MESSAGES.PHONE_NOT_FOUND, this.logger);
      this.sessionManager.delete(chatId);
      this.logger.log(`[phone_not_found] Телефон ${inputText} не найден для chatId: ${chatId}`);
      return;
    }

    this.sessionManager.update(chatId, {
      possibleStaff: staffList,
      phone: inputText,
    });

    if (staffList.length === 1) {
      const singleStaff = staffList[0];
      const hasIdMax = await this.idMaxService.hasIdMax(singleStaff.id);

      if (hasIdMax) {
        await safeReply(ctx, MESSAGES.ALREADY_REGISTERED(singleStaff.firstName, singleStaff.lastName), this.logger);
        this.sessionManager.delete(chatId);
        this.logger.log(`[already_registered] Номер привязан к staffId ${singleStaff.id} для chatId: ${chatId}`);
        return;
      }

      const smsSent = await this.smsSender.sendAuthCode(chatId, inputText);

      if (smsSent) {
        this.sessionManager.update(chatId, {
          matchedStaff: singleStaff,
          step: 'awaiting_code',
        });
        await safeReply(ctx, MESSAGES.SMS_SENT(inputText), this.logger);
      } else {
        await safeReply(ctx, MESSAGES.SMS_SEND_ERROR, this.logger);
        this.sessionManager.delete(chatId);
      }
    } else {
      this.sessionManager.update(chatId, { step: 'awaiting_fullname' });
      const namesList = staffList.map(s => `${s.firstName} ${s.lastName}`).join(', ');
      await safeReply(ctx, MESSAGES.FULLNAME_PROMPT(namesList), this.logger);
      this.logger.log(`[awaiting_fullname] Запрошено ФИО для chatId: ${chatId}`);
    }
  }
}
