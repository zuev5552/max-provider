/* eslint-disable perfectionist/sort-classes */
import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';
import { EventDeduplicatorService } from '../../../utils/event-deduplicator.service';
import { SessionManagerService } from './session.manager.service';

@Injectable()
export class InitChat {
  private readonly logger = new Logger(InitChat.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly prisma: PrismaService,
    private deduplicator: EventDeduplicatorService,
  ) {}

  initChatStart(bot: Bot): void {
    bot.command('init_chat', this.handleInitStart.bind(this));
    bot.on('message_callback', this.handleCallback.bind(this));
    bot.on('bot_added', ctx => this.handleBotAdded(ctx, bot));
  }

  private async handleInitStart(ctx: Context): Promise<void> {
    const chatId = await ctx.chatId;
    const userId = await ctx.user?.user_id;

    if (!chatId || !userId) return;

    this.sessionManager.create(userId);

    const units = await this.fetchUserUnits(userId);
    if (units.length === 0) {
      await ctx.reply('У вас нет доступных подразделений.');
      return;
    }

    const buttons = units.map(unit => Keyboard.button.callback(unit.name, `unitChatInit:${unit.unitId}:${unit.name}`));
    const keyboard = Keyboard.inlineKeyboard([buttons]);

    await ctx.reply('Выберите подразделение:', { attachments: [keyboard] });
  }

  private async handleCallback(ctx: Context): Promise<void> {
    const chatId = await ctx.chatId;
    const userId = await ctx.user?.user_id;
    const payload = await ctx.callback?.payload;
    console.log(payload);

    if (!chatId || !userId || !payload?.startsWith('unitChatInit:')) return;

    // Проверяем, что пользователь ещё не в процессе ожидания чата
    const session = this.sessionManager.get(userId);
    if (session?.step === 'awaiting_chat') {
      await ctx.reply('Вы уже начали процесс создания чата. Добавьте меня в нужный чат и сделайте администратором.');
      return;
    }

    const unitId = payload.split(':')[1];
    const unitName = payload.split(':')[2];
    this.sessionManager.update(userId, {
      unitName,
      unitId,
      step: 'awaiting_chat',
    });

    await ctx.reply(
      `Создайте чат по сырью для <b>${unitName}</b>.\n\n Потом, добавьте меня в него и сделайте администратором.`,
      { format: 'html' },
    );
  }

  private async handleBotAdded(ctx: Context, bot: Bot) {
    console.log(1111);
    // 1. Проверяем на дубликат
    const key = this.deduplicator.getKey(ctx);
    if (!key || this.deduplicator.isDuplicate(key)) return;

    console.log(222);

    const [groupChatId, userId] = [ctx.chatId, ctx.user?.user_id];
    console.log([groupChatId, userId]);

    if (!groupChatId || !userId) return;

    const session = this.sessionManager.get(userId);
    if (!session || session.step !== 'awaiting_chat') return;

    try {
      await bot.api.sendMessageToChat(
        groupChatId,
        `Проверка инициализации чата управления сырьём в пиццерии <b>${session.unitName}</b>. Перейдите в личные сообщения для завершения инициализации`,
        { format: 'html' },
      );

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('OK', `confirm:${groupChatId}`)],
        [Keyboard.button.callback('Проблема', 'retry')],
      ]);
      await bot.api.sendMessageToUser(
        userId,
        `Если в в групповом чате вышло сообщение 
Проверка инициализации чата управления сырьём в пиццерии <b>${session.unitName}</b>

Это значит все в порядке, жмите ОК для завершения инициализации`,
        {
          attachments: [keyboard],
          format: 'html',
        },
      );
    } catch {
      await ctx.reply('Не удалось обработать добавление бота. Попробуйте ещё раз.');
    }
  }

  // private async handleConfirmation(ctx: Context): Promise<void> {
  //   const userId = ctx.user?.user_id;
  //   const payload = ctx.callback?.payload;
  //   const initChatId = ctx.chatId;

  //   if (!userId || !payload || !initChatId) return;

  //   if (payload === 'retry') {
  //     await this.restartInitiation(ctx, userId);
  //     return;
  //   }

  //   if (payload.startsWith('confirm:')) {
  //     const groupChatId = payload.split('confirm:')[1];
  //     const session = this.sessionManager.get(initChatId, userId);
  //     if (!session) return;

  //     this.sessionManager.update(initChatId, userId, {
  //       groupChatId,
  //       step: 'completed',
  //     });

  // await ctx.replyToUser(
  //   userId,
  //   'Чат успешно инициализирован! Теперь я буду отправлять сюда уведомления о низких остатках.',
  // );
  //   }
  // }

  // private async restartInitiation(ctx: Context, userId: string): Promise<void> {
  //   const initChatId = await ctx.chatId?.toString();
  //   if (!initChatId) return;

  //   const session = this.sessionManager.get(initChatId, userId);
  //   if (!session) return;

  //   this.sessionManager.update(initChatId, userId, {
  //     step: 'awaiting_unit',
  //     unitId: undefined,
  //     groupChatId: undefined,
  //   });

  //   // await ctx.replyToUser(userId, 'Давайте начнём заново. Выберите подразделение:');
  //   // await this.handleInitStart(ctx.asUserContext(userId));
  // }

  private async fetchUserUnits(userId: number): Promise<{ unitId: string; name: string }[]> {
    return await this.prisma.$queryRaw`
      SELECT ur."unitId", un."name"
      FROM public.users_units_roles ur
      JOIN public.units un ON un.id = ur."unitId"
      JOIN public.staff st ON st."userId" = ur."userId"
      JOIN public.staff_max imax ON imax."staffId" = st.id
      JOIN public.inventory_settings_units isu ON isu."unitId" = ur."unitId"
      WHERE  1=1
        and imax."idMax" = ${userId}
        and "maxIdChat" is null
      GROUP BY ur."unitId", un."name"
    `;
  }
}
