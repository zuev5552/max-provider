// import { isValidCron } from 'cron-validator';
import * as dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),

  SUPPLY_BOT_TOKEN: z.string().min(1),

  // Postgres
  DATABASE_URL: z.url().min(1),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
