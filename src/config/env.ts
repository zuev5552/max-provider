/**
 * Конфигурация окружения приложения с валидацией через Zod.
 *
 * Загружает переменные окружения из .env-файла и проверяет их соответствие
 * заданной схеме. При несоответствии выбрасывает ошибку с описанием проблемы.
 *
 * @module envConfig
 */
import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

/**
 * Схема валидации переменных окружения приложения.
 *
 * Определяет ожидаемые переменные окружения, их типы и правила валидации.
 * Использует библиотеку Zod для строгой проверки и преобразования типов.
 *
 * @type {z.ZodObject}
 * @property {number} PORT - Порт сервера (положительное число, по умолчанию 3000)
 * @property {string} SUPPLY_BOT_TOKEN - Токен Telegram-бота (обязательное непустое значение)
 * @property {string} DATABASE_URL - URL базы данных PostgreSQL (должен начинаться с postgresql://)
 * @property {number} SESSION_TIMEOUT - Таймаут сессии в миллисекундах (положительное число, по умолчанию 120000)
 * @property {string} SMS_RU_API_ID - API-ключ сервиса SMS.ru (обязательное непустое значение)
 */
const envSchema = z.object({
  PORT: z.coerce.number().positive().default(3000),

  SUPPLY_BOT_TOKEN: z.string().min(1, 'SUPPLY_BOT_TOKEN обязателен'),

  // Postgres
  DATABASE_URL: z.url().refine(url => url.startsWith('postgresql://'), {
    message: 'DATABASE_URL должен использовать протокол postgresql://',
  }),

  //Таймаут на сессии
  SESSION_TIMEOUT: z.coerce.number().positive().default(1200000),

  //API смс модуля
  SMS_RU_API_ID: z.string().min(1),

  // Имена ботов
  SUPPLY_BOT_NAME: z.string().min(1),
});

/**
 * Валидированные переменные окружения приложения.
 *
 * Объект, содержащий переменные окружения после успешной валидации по схеме envSchema.
 * Доступ к переменным осуществляется через свойства этого объекта.
 *
 * @type {Env}
 * @example
 * import { env } from '.config/env';
 * console.log(env.PORT); // 3000
 */
export const env = envSchema.parse(process.env);

/**
 * Тип для валидированных переменных окружения.
 *
 * Автоматически выводится из схемы envSchema с помощью z.infer.
 * Позволяет использовать строго типизированные переменные окружения в коде.
 *
 * @typedef {z.infer<typeof envSchema>} Env
 * @example
 * function startServer(config: Env) {
 *   console.log(`Server running on port ${config.PORT}`);
 * }
 */
export type Env = z.infer<typeof envSchema>;
