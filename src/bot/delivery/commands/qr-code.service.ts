/* eslint-disable perfectionist/sort-classes */
import { Context } from '@maxhub/max-bot-api';
import { Injectable, Logger } from '@nestjs/common';
import fs from 'fs';
import path from 'path';

import { PrismaService } from '../../../../prisma/prisma.service';

/**
 * Сервис для работы с QR‑кодами оплаты для курьеров
 * Предоставляет функционал получения и отправки QR‑кодов оплаты
 * в зависимости от пиццерии, где работает курьер
 */
@Injectable()
export class PaymentQrCodeService {
  private readonly logger = new Logger(PaymentQrCodeService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Основной метод для показа QR‑кода оплаты пользователю
   * Выполняет последовательность действий:
   * 1. Получает ID пользователя из контекста
   * 2. Запрашивает данные о юнитах, токене доступа и staffId
   * 3. Проверяет наличие открытой смены курьера
   * 4. Отправляет QR‑код оплаты для пиццерии
   *
   * @param ctx Контекст сообщения от пользователя
   */
  async showQrCode(ctx: Context): Promise<void> {
    let userId: number | undefined;

    try {
      userId = ctx.user?.user_id;
      if (!userId) {
        await ctx.reply('Не удалось определить ID пользователя.');
        return;
      }

      // 1. Получаем данные о юнитах,  токене доступа и staffId курьера
      const staffUnitsData = await this.getStaffDepartmentUnits(userId);
      if (!staffUnitsData) {
        await ctx.reply('Вашей учётной записи нет в системе');
        return;
      }
      const { units, accessToken, staffId } = staffUnitsData;

      // 2. Получаем информацию о смене курьера
      const shiftInfo = await this.getCourierShiftInfo(units, accessToken, staffId);
      if (!shiftInfo) {
        await ctx.reply('У вас нет открытой смены в пиццерии');
        return;
      }

      // 3. Получаем и отправляем QR‑код оплаты
      await this.sendPaymentQrCode(ctx, shiftInfo.unitName);
    } catch (error) {
      this.logger.error(`Ошибка в showQrCode для пользователя ${userId ?? 'unknown'}: ${error.message}`);
      await ctx.reply('Произошла ошибка при получении QR‑кода.');
    }
  }

  /**
   * Получает данные о юнитах, токене доступа и ID сотрудника из базы данных
   * Выполняет SQL‑запрос для получения:
   * - списка юнитов (пиццерий) через STRING_AGG
   * - токена доступа пользователя
   * - ID сотрудника (staffId)
   *
   * @param userId ID пользователя в системе
   * @returns Объект с полями units, accessToken, staffId или null, если данные не найдены
   */
  private async getStaffDepartmentUnits(
    userId: number,
  ): Promise<{ units: string; accessToken: string; staffId: string } | null> {
    try {
      const result = (await this.prisma.$queryRaw`
        SELECT
          STRING_AGG(DISTINCT dep2."unitId"::text, ',') AS units,
          us."accessToken",
          max."staffId"
        FROM public.staff_max max
        JOIN public.staff st ON st.id = max."staffId"
        LEFT JOIN public.units u ON u.id = st."unitId"
        JOIN public.users_units_roles r ON r."unitId" = u.id
        JOIN public.units_departments d ON d."unitId" = u.id
        JOIN public.users us ON us.id = r."userId"
        JOIN public.units_departments dep2 ON dep2."departmentId" = d."departmentId"
        JOIN public.units u2 ON u2.id = dep2."unitId" AND u2."typeId" = 1
        WHERE max."idMax" = ${userId}
        GROUP BY r."userId", us."accessToken", max."staffId";
      `) as Array<{ units: string; accessToken: string; staffId: string }>;

      if (result.length === 0) {
        this.logger.warn(`Нет данных для пользователя с ID: ${userId}`);
        return null;
      }

      return result[0];
    } catch (error) {
      this.logger.error(`Ошибка запроса к БД для пользователя ${userId}: ${error.message}`);
      return null;
    }
  }

  /**
   * Получает информацию о текущей смене курьера через внешний API
   * Отправляет GET‑запрос к API DodoIS для получения данных о смене
   *
   * @param units Список юнитов (пиццерий), разделённых запятой
   * @param accessToken Токен доступа для авторизации в API
   * @param staffId ID сотрудника в системе
   * @returns Информация о смене курьера или null, если смена не найдена
   */
  private async getCourierShiftInfo(
    units: string,
    accessToken: string,
    staffId: string,
  ): Promise<CouriersOnShift | null> {
    const baseUrl = 'https://api.dodois.io/dodopizza/ru/staff/couriers-on-shift';
    const params = new URLSearchParams({ units });
    const url = `${baseUrl}?${params.toString()}`;
    const options = {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
    };

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        this.logger.warn(`HTTP error при запросе смены курьера: статус ${response.status}, URL: ${url}`);
        return null;
      }

      const data = await response.json();

      if (!data?.couriers || !Array.isArray(data.couriers)) {
        this.logger.warn('Некорректный ответ от API: отсутствует массив couriers');
        return null;
      }

      const staffShift = data.couriers.find((el: CouriersOnShift) => el.id === staffId);
      return staffShift || null;
    } catch (error) {
      this.logger.error(`Ошибка получения данных о смене: ${error.message}`);
      return null;
    }
  }

  /**
   * Отправляет QR‑код оплаты пользователю через бота
   * 1. Получает путь к файлу QR‑кода
   * 2. Проверяет существование файла
   * 3. Загружает изображение через API бота
   * 4. Отправляет сообщение с QR‑кодом и предупреждением
   *
   * @param ctx Контекст сообщения
   * @param unitName Название пиццерии (например, «Тюмень‑1»)
   */
  private async sendPaymentQrCode(ctx: Context, unitName: string): Promise<void> {
    const qrCodePath = this.getQrCodePath(unitName);

    if (!qrCodePath) {
      await ctx.reply(`QR-код для пиццерии ${unitName} не найден.`);
      return;
    }

    try {
      // Проверяем существование файла перед чтением
      if (!fs.existsSync(qrCodePath)) {
        this.logger.warn(`Файл QR-кода не найден: ${qrCodePath}`);
        await ctx.reply(`QR-код для пиццерии ${unitName} не найден (файл отсутствует).`);
        return;
      }

      const image = await ctx.api.uploadImage({
        source: fs.readFileSync(qrCodePath),
      });

      await ctx.reply('<b>Внимание: нельзя оплачивать частями. Вся оплата через QR‑код</b>', {
        attachments: [image.toJson()],
        format: 'html',
      });
    } catch (fileError) {
      this.logger.error(`Ошибка загрузки QR-кода для ${unitName}: ${fileError.message}`);
      await ctx.reply(`Не удалось загрузить QR-код для пиццерии ${unitName}.`);
    }
  }

  /**
   * Определяет путь к файлу QR‑кода на основе названия пиццерии
   * Ищет файл в двух возможных расположениях:
   * 1. В папке сборки (dist/src/images)
   * 2. В исходной папке (src/images)
   *
   * @param unitName Название пиццерии (например, «Тюмень‑1»)
   * @returns Полный путь к файлу QR‑кода или null, если файл не найден
   */
  private getQrCodePath(unitName: string): null | string {
    // Определяем базовый путь: сначала ищем в dist, затем в src
    const basePaths = [path.join(process.cwd(), 'dist', 'src', 'images'), path.join(process.cwd(), 'src', 'images')];

    const unitMap: Record<string, string> = {
      'Тюмень-1': 'tmn-1.png',
      'Тюмень-2': 'tmn-2.png',
      'Тюмень-3': 'tmn-3.png',
      'Тюмень-4': 'tmn-4.png',
      'Тюмень-5': 'tmn-5.png',
      'Тюмень-6': 'tmn-6.png',
      'Тюмень-7': 'tmn-7.png',
      'Тюмень-8': 'tmn-8.png',
    };

    const fileName = unitMap[unitName];
    if (!fileName) return null;

    // Пробуем найти файл в каждом из базовых путей
    for (const basePath of basePaths) {
      const fullPath = path.join(basePath, fileName);
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }

    return null;
  }
}

type CouriersOnShift = {
  id: string;
  clockInAt: string;
  clockInAtLocal: string;
  scheduledClockInAt: string;
  scheduledClockInAtLocal: string;
  positionId: string;
  positionName: string;
  scheduleId: string;
  unitId: string;
  unitName: string;
  deliveredOrdersCount: number;
  lateOrdersCount: number;
  cashFromOrders: number;
};
