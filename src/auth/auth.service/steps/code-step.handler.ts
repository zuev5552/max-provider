import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { IdMaxService } from '../idmax.service';
import { SessionManagerService } from '../session.manager.service';
import { MESSAGES } from '../utils/messages.constants';
import { safeReply } from '@/utils/bot/safe-reply.util';
import { CodeGeneratorService } from '@/utils/core/code.generator.service';


/**
 * Обработчик шага ввода SMS‑кода в процессе аутентификации.
 *
 * Отвечает за:
 * - проверку формата введённого кода;
 * - подсчёт количества попыток ввода;
 * - сравнение введённого кода с сохранённым в сессии;
 * - ограничение количества попыток (максимум 10);
 * - привязку ID пользователя к сотруднику при успешном вводе;
 * - отправку соответствующих сообщений пользователю на каждом этапе.
 *
 * @Injectable
 * @class CodeStepHandler
 */
@Injectable()
export class CodeStepHandler {
  private readonly logger = new Logger(CodeStepHandler.name);
  private readonly MAX_ATTEMPTS = 10;

  /**
   * Создаёт экземпляр обработчика ввода SMS‑кода.
   *
   * @param {SessionManagerService} sessionManager — сервис управления сессиями аутентификации,
   *   предоставляет доступ к данным сессии пользователя по `chatId`
   * @param {IdMaxService} idMaxService — сервис для работы с ID пользователей,
   *   отвечает за привязку ID бота к внутреннему идентификатору сотрудника
   * @param {CodeGeneratorService} codeGenerator — сервис генерации и валидации SMS‑кодов,
   *   проверяет корректность введённого пользователем кода
   */
  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly idMaxService: IdMaxService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

  /**
   * Обрабатывает ввод SMS‑кода пользователем.
   * Выполняет следующие шаги:
   * 1. Получает сессию пользователя по `chatId`.
   * 2. Проверяет формат введённого кода.
   * 3. Преобразует текст в число и проверяет на `NaN`.
   * 4. Проверяет наличие данных о сотруднике (`matchedStaff`) в сессии.
   * 5. Обновляет счётчик попыток ввода кода.
   * 6. Проверяет превышение лимита попыток (10).
   * 7. Сравнивает введённый код с сохранённым в сессии.
   * 8. При успешном совпадении:
   *    - привязывает ID пользователя к сотруднику через `idMaxService`;
   *    - удаляет сессию;
   *    - отправляет сообщение об успешной авторизации.
   * 9. При несовпадении кода:
   *    - сообщает количество оставшихся попыток;
   *    - логирует ошибку.
   *
   * @param {Context} ctx — контекст сообщения, содержащий данные о чате и пользователе
   * @param {number} chatId — идентификатор чата/пользователя
   * @param {string} inputText — текст сообщения от пользователя (введённый SMS‑код)
   *
   * @returns {Promise<void>} — асинхронное выполнение без возвращаемого значения
   */
  async handle(ctx: Context, chatId: number, inputText: string): Promise<void> {
    const session = this.sessionManager.get(chatId);
    if (!session) {
      await safeReply(ctx, MESSAGES.SESSION_NOT_FOUND, this.logger);
      return;
    }

    // Проверка формата кода
    if (!this.codeGenerator.isValidCodeInput(inputText)) {
      await safeReply(ctx, MESSAGES.CODE_INVALID, this.logger);
      return;
    }

    const code = parseInt(inputText, 10);
    if (isNaN(code)) {
      await safeReply(ctx, MESSAGES.CODE_ERROR, this.logger);
      return;
    }

    if (!session.matchedStaff) {
      await safeReply(ctx, MESSAGES.STAFF_NOT_FOUND, this.logger);
      this.sessionManager.delete(chatId);
      return;
    }

    // Обновляем счётчик попыток
    const attemptsCount = (session.attemptsCount ?? 0) + 1;
    this.sessionManager.update(chatId, { attemptsCount });

    // Проверяем лимит попыток
    if (attemptsCount >= this.MAX_ATTEMPTS) {
      this.sessionManager.delete(chatId);
      await safeReply(ctx, MESSAGES.ATTEMPTS_EXCEEDED, this.logger);
      this.logger.log(`[attempts_exceeded] chatId: ${chatId}, превышено количество попыток`);
      return;
    }

    // Сравниваем введённый код с сохранённым
    if (session.code === code) {
      const userId = ctx.user?.user_id;
      if (!userId) return;
      // Сохраняем idMax в БД
      await this.idMaxService.linkIdMax(session.matchedStaff.id, userId);

      // Успешная авторизация — завершаем процесс
      this.sessionManager.delete(chatId);

      await safeReply(
        ctx,
        MESSAGES.SUCCESS_AUTH(session.matchedStaff.lastName, session.matchedStaff.firstName),
        this.logger,
      );
      this.logger.log(`[auth_success] Успешная авторизация для staffId: ${session.matchedStaff.id}, chatId: ${chatId}`);
    } else {
      // Неверный код — сообщаем сколько осталось попыток
      const remainingAttempts = this.MAX_ATTEMPTS - attemptsCount;
      await safeReply(ctx, MESSAGES.ATTEMPT_FAILED(remainingAttempts), this.logger);
      this.logger.log(`[code_mismatch] Неверный код для chatId: ${chatId}, попыток осталось: ${remainingAttempts}`);
    }
  }
}
