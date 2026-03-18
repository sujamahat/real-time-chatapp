import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  CLIENT_ORIGIN: z.string().url(),
  COOKIE_NAME: z.string().min(1).default("chatapp_token"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  MAX_UPLOAD_SIZE_MB: z.coerce.number().positive().default(8),
  PUBLIC_FILE_BASE_URL: z.string().url().optional(),
  STORAGE_PROVIDER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().positive().default(10),
  AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(10 * 60 * 1000),
  MESSAGE_RATE_LIMIT_MAX: z.coerce.number().positive().default(40),
  MESSAGE_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(60 * 1000),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().positive().default(20),
  UPLOAD_RATE_LIMIT_WINDOW_MS: z.coerce.number().positive().default(10 * 60 * 1000)
});

export const env = envSchema.parse(process.env);
