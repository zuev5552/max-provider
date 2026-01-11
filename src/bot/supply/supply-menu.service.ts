/* eslint-disable perfectionist/sort-classes */
import { Context, Keyboard } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';

import { ShowChangeStockService } from './show-stock/show-change-stock.service';
import { SessionService } from '@/utils/session/session.service';

/**
 * Сервис для отображения меню по контролю остатков сырья, раздела FAQ и обработки запросов на ручной ввод ингредиентов.
 *
 * Предоставляет:
 * - интерактивное меню с категориями сырья (тесто, коробки, дополнительные ингредиенты);
 * - раздел часто задаваемых вопросов с инструкциями по работе с ботом;
 * - функционал для ручного ввода наименования сырья с управлением состоянием диалога.
 *
 * @example
 * ```typescript
 * const supplyMenuService = new SupplyMenuService(sessionStockService, showChangeStockService);
 * await supplyMenuService.showSupplyMenu(ctx);    // Показать меню сырья
 * await supplyMenuService.showFaq(ctx);         // Показать раздел FAQ
 * await supplyMenuService.showChangeStock(ctx); // Активировать ввод сырья
 * ```
 */
@Injectable()
export class SupplyMenuService {
  private readonly logger = new Logger(SupplyMenuService.name);

  constructor(
    private sessionService: SessionService,
    private showChangeStockService: ShowChangeStockService,
  ) {}

  /**
   * Отображает интерактивное меню для работы с остатками сырья.
   *
   * Меню содержит:
   * - ссылку на раздел FAQ;
   * - опцию ручного ввода наименования сырья;
   * - категории сырья с конкретными позициями (тесто разных видов, коробки разных размеров);
   * - кнопку возврата в главное меню.
   *
   * @param ctx - Контекст сообщения от бота, содержащий данные о чате и пользователе.
   *   Обязательное поле:
   *   - `chatId` или `message.chat.id` — ID чата для отправки сообщения.
   *
   * @returns {Promise<void>} — Promise, разрешающийся после успешной отправки меню в чат.
   *
   * @throws {Error} — Ошибки отправки сообщения логируются внутри метода.
   *   Пользователь получает обобщённое сообщение об ошибке (если возможно).
   *
   * @example
   * ```typescript
   * await supplyMenuService.showSupplyMenu(ctx);
   * ```
   */
  async showSupplyMenu(ctx: Context): Promise<void> {
    const keyboard = Keyboard.inlineKeyboard([
      [Keyboard.button.callback('FAQ по программе сырье', 'faq-supply')],
      [Keyboard.button.callback('Введите наименование сырья', 'change-supply')],
      [
        Keyboard.button.callback('20 Тесто', 'Тесто 20'),
        Keyboard.button.callback('25 Тесто', 'Тесто 25'),
        Keyboard.button.callback('30 Тесто', 'Тесто 30'),
        Keyboard.button.callback('35 Тесто', 'Тесто 35'),
      ],
      [
        Keyboard.button.callback('Box 20', 'Коробка 20'),
        Keyboard.button.callback('Box 25', 'Коробка 25'),
        Keyboard.button.callback('Box 30', 'Коробка 30'),
        Keyboard.button.callback('Box 35', 'Коробка 35'),
      ],
      [
        Keyboard.button.callback('Коробка для закусок', 'Коробка для закусок'),
        Keyboard.button.callback('Сыр моцарелла', 'Сыр моцарелла'),
      ],
      [Keyboard.button.callback('Назад', 'back-welcome-menu')],
    ]);

    await ctx.reply('Выберите действие:', {
      attachments: [keyboard],
    });
  }

  /**Отправляет пользователю раздел часто задаваемых вопросов (FAQ) с инструкциями.*/
  async showFaq(ctx: Context): Promise<void> {
    const message = `<b>Вопрос 1.</b> Когда бот определяет что ингридиент проблемный?
  Логика работы у бота следующая. 
Каждый час бот забирает с Додо ИС складские остатки. Далее он сверяет какой расход будет в текущий день (учитываются как праздничные дни, так и будни). Если сырья осталось менее чем минимальная норма это считается проблеммой и формируется соответствующее сообщение. 

Например, в пиццерии средний расход сыра моцарелла в будни 50 килограм. 
Минимальная норма 30 киллограм.
Если в 16:30 вечера сыра моцареллы останется меньше 30 киллограмм, то будет создано соответсвующее сообщение о проблемме.
Размер минимальной нормы (в % от среднедневного расхода) устанавливается в настройках на сайте dodo-sky.ru

<b>Вопрос 2.</b> Как настроить бота?
В настройках бота возможно настроить время уведомлений, в какие пиццерии рассылать уведомления, какой минимальный остаток и прочее. Все настройки делаются на сайте dodo-sky.ru по  учетной записью с правами манедежера офиса.

<b>Вопрос 3.</b> Что за время указано вначале сообщения?
  Данные по остатку собираются непосредственно с Dodo IS. При этом Dodo IS выдает данные один раз в час, и соответсвенно в сообщение указывается на какое время актуален остаток по сырью. При этом время сообщения и время остатка может различаться.
Время указывается в формате <a href="https://time.is/UTC?says">UTC</a>.

<b>Вопрос 4.</b> Как добавить сотрудника в бот?
  Для того чтобы ваш сотрудник мог пользоваться ботом и видеть остатки пиццерии то его ID должен быть внесен на сайте dodo-sky.ru в разделе ID телеграмм.

<b>Вопрос 5.</b> Почему сообщение о проблеме приходит только один раз в день?
  Чтобы исключить спам программа настроена так что сообщение выйдет только один раз в сутки. На следующий день в 09:00 программа обновляется и сообщения снова придут один раз в очередные сутки. Исключается повтор сообщения только в том случае, если проблемное сырье не повторяется.
`;
    await ctx.reply(message, {
      format: 'html',
    });
  }

  /**
   * Активирует режим ручного ввода наименования ингредиента для проверки остатков.
   * Выполняет следующие действия:
   * 1. Отправляет запрос на ввод названия ингредиента.
   * 2. Формирует ключ идентификации пользователя/чата.
   * 3. Сохраняет состояние диалога в сессии (`awaiting_itemName`).
   *
   * @param ctx - Контекст сообщения от бота, содержащий данные о пользователе и чате.
   *   Обязательные поля:
   *   - `callback.user.user_id` — ID пользователя для формирования ключа сессии.
   *   - `chatId` или `message.chat.id` — ID чата для отправки сообщений.
   *
   * @returns {Promise<void>} — Promise, разрешающийся после:
   *   - успешной активации режима ввода;
   *   - обработки ошибки (с отправкой сообщения пользователю).
   *
   * @throws {Error} — Ошибки логируются внутри метода:
   *   - при отсутствии ключа идентификации;
   *   - при ошибках сохранения состояния сессии.
   *   В случае ошибки пользователь получает сообщение «Произошла ошибка при обработке команды. Попробуйте снова.».
   *
   * @example
   * ```typescript
   * await supplyMenuService.showChangeStock(ctx);
   * ```
   */
  async showChangeStock(ctx: Context): Promise<void> {
    try {
      await ctx.reply('Напишите название ингредиента');

      // Формируем ключ для идентификации чата/пользователя
      const key = ctx.callback?.user.user_id;
      if (!key) {
        this.logger.warn('Не удалось получить ключ для диалога (chatId/userId отсутствует)');
        await ctx.reply('Произошла ошибка. Попробуйте позже.');
        return;
      }

      // Сохраняем состояние диалога
      this.sessionService.create(key, { state: 'awaiting_itemName' });
      this.logger.log(`Диалог установлен для ключа ${key}: awaiting_itemName`);
    } catch (error) {
      this.logger.error('Ошибка в обработчике команды /change', error);
      await ctx.reply('Произошла ошибка при обработке команды. Попробуйте снова.');
    }
  }
}
