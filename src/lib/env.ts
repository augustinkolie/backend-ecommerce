import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().optional(),
  MEILI_URL: z.string().optional(),
  MEILI_MASTER_KEY: z.string().optional(),
  FRONTEND_URL: z.string().default("http://localhost:3000"),
  /** URL interne du frontend, pour l'appel de revalidation. */
  FRONTEND_INTERNAL_URL: z.string().optional(),
  REVALIDATE_SECRET: z.string().default(""),
  API_SERVICE_KEY: z.string().default(""),
  JWT_SECRET: z.string().min(32),
  SMTP_URL: z.string().default("smtp://localhost:1026"),
  MAIL_FROM: z.string().default("Leppi <bonjour@leppi.local>"),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  PUBLIC_API_URL: z.string().default("http://localhost:4000"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  S3_PUBLIC_URL: z.string().optional(),
  PAYMENT_WEBHOOK_SECRET: z.string().default("dev-webhook-secret"),
  ORANGE_MONEY_CLIENT_ID: z.string().optional(),
  ORANGE_MONEY_CLIENT_SECRET: z.string().optional(),
  MTN_MOMO_SUBSCRIPTION_KEY: z.string().optional(),
  JOBS_SECRET: z.string().default(""),
});

let cached: z.infer<typeof schema> | undefined;

/** Variables d'environnement validées au premier accès. */
export function env() {
  cached ??= schema.parse(process.env);
  return cached;
}

export const isProd = () => env().NODE_ENV === "production";
