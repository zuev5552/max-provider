import { Injectable, Logger } from '@nestjs/common';
import { SMSRu } from 'node-sms-ru';

import { SessionManagerService } from '../session.manager.service';
import { CodeGeneratorService } from '@/utils/code.generator.service';

@Injectable()
export class SmsSenderUtil {
  private readonly logger = new Logger(SmsSenderUtil.name);

  constructor(
    private readonly smsRu: SMSRu,
    private readonly sessionManager: SessionManagerService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  async sendAuthCode(chatId: number, phone: string): Promise<boolean> {
    try {
      const newCode = this.codeGenerator.generateCode();
      const now = Date.now();

      try {
        await this.sessionManager.update(chatId, {
          code: newCode,
          lastSmsSentAt: now,
          attemptsCount: 0,
        });
        this.logger.debug(`[session_updated] Код ${String(newCode)} сохранён для chatId: ${chatId}`);
      } catch (sessionError) {
        this.logger.error(`Ошибка при обновлении сессии для chatId ${chatId}: ${sessionError.message}`);
        return false;
      }

      this.logger.debug(`[sms_sending] Отправка кода ${String(newCode)} на номер ${phone}`);

      const smsResult = await this.smsRu.sendSms({
        to: phone,
        msg: `Код авторизации на сайте Dodo-sky: ${String(newCode)}`,
        test: true,
      });

      if (smsResult.status === 'OK') {
        this.logger.log(`[sms_sent] Код ${String(newCode)} успешно отправлен на ${phone} для chatId: ${chatId}`);
        return true;
      } else {
        this.logger.error(`Не удалось отправить SMS на номер ${phone}, ошибка: ${smsResult.status}`);
        return false;
      }
    } catch (error) {
      this.logger.error(`Критическая ошибка при отправке SMS: ${error.message}`, error.stack);
      return false;
    }
  }
}
