/* eslint-disable perfectionist/sort-classes */
import { Bot, Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { PrismaService } from '../../../../prisma/prisma.service';
import { EventDeduplicatorService } from '../../../utils/event-deduplicator.service';
import { SessionManagerService } from './session.manager.service';

type NextFunction = () => Promise<void>;

/**
 * Сервис для инициализации чата управления сырьём в боте.
 * Реализует пошаговый процесс:
 * 1. Выбор подразделения (/init_chat)
 * 2. Добавление бота в групповой чат по сырью
 * 3. Подтверждение инициализации
 */
@Injectable()
export class InitChat {
  private readonly logger = new Logger(InitChat.name);

  constructor(
    private readonly sessionManager: SessionManagerService,
    private readonly prisma: PrismaService,
    private deduplicator: EventDeduplicatorService,
  ) {}

  /**
   * Инициализирует обработчики команд и событий бота.
   * @param bot Экземпляр бота MaxHub
   */
  initChatStart(bot: Bot): void {
    bot.command('init_chat', this.handleInitStart.bind(this));
    bot.on('message_callback', (ctx, next) => this.handleCallback(ctx, next));
    bot.on('bot_added', (ctx, next) => this.handleBotAdded(ctx, bot, next));
  }

  /**
   * Обрабатывает команду /init_chat — запускает процесс инициализации чата.
   * @param ctx Контекст сообщения
   */
  private async handleInitStart(ctx: Context): Promise<void> {
    const chatId = ctx.chatId;
    const userId = ctx.user?.user_id;

    if (!chatId || !userId) return;

    this.sessionManager.create(userId);

    const units = await this.fetchUserUnits(userId);
    console.log(units);
    if (units.length === 0) {
      await ctx.reply('У вас нет доступных подразделений.');
      return;
    }

    const buttons = units.map(unit => Keyboard.button.callback(unit.name, `unitChatInit:${unit.unitId}:${unit.name}`));
    const keyboard = Keyboard.inlineKeyboard([buttons]);

    await ctx.reply('Выберите подразделение:', { attachments: [keyboard] });
  }

  /**
   * Обрабатывает callback‑запросы (нажатия кнопок).
   * @param ctx Контекст сообщения с callback‑данными
   * @param next Функция перехода к следующему middleware
   */
  private async handleCallback(ctx: Context, next: NextFunction): Promise<void> {
    const payload = ctx.callback?.payload;
    if (!payload) return next();

    if (payload.startsWith('unitChatInit:')) {
      return this.handleUnitSelection(ctx);
    }
    if (payload.startsWith('confirmInitChat:')) {
      return this.handleConfirmation(ctx);
    }
    if (payload === 'retryInitChat') {
      return this.handleInitStart(ctx);
    }

    return next();
  }

  /**
   * Обрабатывает выбор подразделения через кнопку.
   * @param ctx Контекст сообщения с payload кнопки
   */
  private async handleUnitSelection(ctx: Context): Promise<void> {
    const chatId = ctx.chatId;
    const userId = ctx.user?.user_id;
    const payload = ctx.callback?.payload;

    if (!chatId || !userId || !payload) return;

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

  /**
   * Обрабатывает событие добавления бота в чат.
   * Проверяет:
   * - Дубликаты событий
   * - Валидность сессии
   * - Занятость чата
   * @param ctx Контекст события
   * @param bot Экземпляр бота
   * @param next Функция перехода к следующему middleware
   */
  private async handleBotAdded(ctx: Context, bot: Bot, next: NextFunction) {
    //Проверяем на дубликат
    const key = this.deduplicator.getKey(ctx);
    if (!key || this.deduplicator.isDuplicate(key)) return await next();

    const [groupChatId, userId] = [ctx.chatId, ctx.user?.user_id];
    if (!groupChatId || !userId) return await next();

    const session = this.sessionManager.get(userId);
    if (!session || session.step !== 'awaiting_chat') return await next();

    // Проверка занятости чата + получение названия пиццерии
    const occupant = await this.prisma.inventorySettingsUnit.findFirst({
      where: { maxIdChat: groupChatId },
      select: { unitName: true },
    });
    if (occupant) {
      await ctx.reply(
        `Этот чат уже используется для пиццерии <b>${occupant.unitName}</b>. ` +
          `Пожалуйста, создайте новый чат для инициализации.`,
        { format: 'html' },
      );
      this.sessionManager.delete(userId);
      return;
    }

    try {
      await bot.api.sendMessageToChat(
        groupChatId,
        `Проверка инициализации чата управления сырьём в пиццерии <b>${session.unitName}</b>. Перейдите в личные сообщения для завершения инициализации`,
        { format: 'html' },
      );

      const keyboard = Keyboard.inlineKeyboard([
        [Keyboard.button.callback('OK', `confirmInitChat:${groupChatId}`)],
        [Keyboard.button.callback('Проблема', 'retryInitChat')],
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

  /**
   * Обрабатывает подтверждение инициализации через кнопку «OK».
   * Сохраняет chatId в БД и завершает процесс.
   * @param ctx Контекст callback‑запроса
   */
  private async handleConfirmation(ctx: Context): Promise<void> {
    const userId = ctx.user?.user_id;
    const payload = ctx.callback?.payload;

    if (!userId || !payload) return;

    if (payload.startsWith('confirmInitChat:')) {
      const groupChatId = Number(payload.split('confirmInitChat:')[1]);

      const session = this.sessionManager.get(userId);
      if (!session) return;
      const unitId = session?.unitId;
      if (!unitId) return;

      // Обновляем запись в базе данных
      await this.prisma.inventorySettingsUnit.update({
        where: { unitId: unitId },
        data: { maxIdChat: groupChatId },
      });

      this.sessionManager.update(userId, {
        groupChatId,
      });
      await ctx.reply(
        `Чат для пиццерии <b>${session.unitName}</b> успешно инициализирован! Теперь я смогу уведомлять об остатках`,
        { format: 'html' },
      );

      // удаляем сессию
      this.sessionManager.delete(userId);
    }
  }

  /**
   * Получает список доступных подразделений пользователя из БД.
   * Фильтрует подразделения, где maxIdChat == null (чат не инициализирован).
   * @param userId ID пользователя в системе
   * @returns Массив объектов { unitId, name }
   */
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
