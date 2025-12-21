// import { isValidCron } from 'cron-validator';
import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

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
  
});

export const env = envSchema.parse(process.env);
export type Env = z.infer<typeof envSchema>;
