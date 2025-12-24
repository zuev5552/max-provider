import { Injectable, Logger } from '@nestjs/common';
import { SMSRu } from 'node-sms-ru';

import { SessionManagerService } from '../session.manager.service';
import { CodeGeneratorService } from '@/utils/code.generator.service';

/**
 * Утилита отправки SMS‑кодов подтверждения через сервис SMS.ru.
 *
 * Отвечает за:
 * - генерацию нового SMS‑кода с помощью `CodeGeneratorService`;
 * - сохранение кода и метаданных (время отправки, счётчик попыток) в сессии пользователя;
 * - отправку SMS через API сервиса SMS.ru;
 * - логирование этапов отправки (генерация, сохранение, отправка, результат);
 * - обработку ошибок на каждом этапе с логированием и возвратом статуса операции.
 *
 * Используется в процессе аутентификации для подтверждения номера телефона.
 *
 * @Injectable
 * @class SmsSenderUtil
 */
@Injectable()
export class SmsSenderUtil {
  private readonly logger = new Logger(SmsSenderUtil.name);

    /**
   * Создаёт экземпляр утилиты отправки SMS.
   *
   * @param {SMSRu} smsRu — экземпляр клиента для работы с API SMS.ru,
   *   предоставляет метод `sendSms()` для отправки сообщений
   * @param {SessionManagerService} sessionManager — сервис управления сессиями аутентификации,
   *   используется для сохранения сгенерированного кода и временных меток в сессии пользователя
   * @param {CodeGeneratorService} codeGenerator — сервис генерации SMS‑кодов,
   *   предоставляет метод `generateCode()` для создания случайного числового кода
   */
  constructor(
    private readonly smsRu: SMSRu,
    private readonly sessionManager: SessionManagerService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

    /**
   * Отправляет SMS‑код подтверждения на указанный номер телефона.
   * Выполняет следующие шаги:
   * 1. Генерирует новый SMS‑код с помощью `codeGenerator.generateCode()`.
   * 2. Сохраняет код, время отправки (`lastSmsSentAt`) и обнуляет счётчик попыток (`attemptsCount`)
   *    в сессии пользователя через `sessionManager.update()`.
   * 3. Отправляет SMS через API SMS.ru (`smsRu.sendSms()`) с текстом:
   *    «Код авторизации на сайте Dodo-sky: [код]».
   * 4. Проверяет статус ответа от SMS.ru:
   *    - если `status === 'OK'`, логирует успех и возвращает `true`;
   *    - иначе логирует ошибку и возвращает `false`.
   * 5. Обрабатывает ошибки:
   *    - при сохранении в сессии: логирует ошибку, возвращает `false`;
   *    - при отправке SMS: логирует ошибку статуса, возвращает `false`;
   *    - критические ошибки (непредвиденные): логирует с трассировкой стека, возвращает `false`.
   *
   * @param {number} chatId — идентификатор чата/пользователя, для которого генерируется и отправляется код
   * @param {string} phone — номер телефона получателя в формате, поддерживаемом SMS.ru
   *
   * @returns {Promise<boolean>} — `true`, если SMS успешно отправлен и сессия обновлена,
   *   `false` в случае любой ошибки (генерация кода, сохранение сессии, отправка SMS, непредвиденные ошибки)
   *
   * @example
   * const smsSender = new SmsSenderUtil(smsRu, sessionManager, codeGenerator);
   * const success = await smsSender.sendAuthCode(12345, '+79991234567');
   * if (success) {
   *   // Код отправлен, ожидаем ввода от пользователя
   * } else {
   *   // Ошибка отправки, обрабатываем ситуацию
   * }
   */
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
