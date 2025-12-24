import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { IdMaxService } from '../idmax.service';
import { SessionManagerService } from '../session.manager.service';
import { MESSAGES } from '../utils/messages.constants';
import { CodeGeneratorService } from '@/utils/code.generator.service';
import { safeReply } from '@/utils/safe-reply.util';

@Injectable()
export class CodeStepHandler {
  private readonly logger = new Logger(CodeStepHandler.name);
  private readonly MAX_ATTEMPTS = 10;

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly idMaxService: IdMaxService,
    private readonly codeGenerator: CodeGeneratorService,
  ) {}

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
      console.log(session);
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
