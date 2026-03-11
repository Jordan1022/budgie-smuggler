import { z } from "zod";

const optional = z.string().trim().optional().default("");

const envSchema = z.object({
  NEXT_PUBLIC_APP_NAME: optional,
  NEXT_PUBLIC_APP_URL: optional,
  NEXT_PUBLIC_SUPABASE_URL: optional,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: optional,
  SUPABASE_SERVICE_ROLE_KEY: optional,
  DATABASE_URL: optional,
  PLAID_CLIENT_ID: optional,
  PLAID_SECRET: optional,
  PLAID_ENV: z.enum(["sandbox", "development", "production"]).default("sandbox"),
  PLAID_WEBHOOK_SECRET: optional,
  RESEND_API_KEY: optional,
  ALERT_FROM_EMAIL: optional,
  DATA_ENCRYPTION_KEY: optional,
});

let cachedEnv: z.infer<typeof envSchema> | null = null;

export function env() {
  if (cachedEnv) {
    return cachedEnv;
  }

  cachedEnv = envSchema.parse({
    NEXT_PUBLIC_APP_NAME: process.env.NEXT_PUBLIC_APP_NAME,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
    PLAID_CLIENT_ID: process.env.PLAID_CLIENT_ID,
    PLAID_SECRET: process.env.PLAID_SECRET,
    PLAID_ENV: process.env.PLAID_ENV,
    PLAID_WEBHOOK_SECRET: process.env.PLAID_WEBHOOK_SECRET,
    RESEND_API_KEY: process.env.RESEND_API_KEY,
    ALERT_FROM_EMAIL: process.env.ALERT_FROM_EMAIL,
    DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY,
  });

  return cachedEnv;
}

export function isSupabaseConfigured() {
  const parsed = env();
  return Boolean(parsed.NEXT_PUBLIC_SUPABASE_URL && parsed.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function isDatabaseConfigured() {
  return Boolean(env().DATABASE_URL);
}

export function isPlaidConfigured() {
  const parsed = env();
  return Boolean(parsed.PLAID_CLIENT_ID && parsed.PLAID_SECRET);
}

export function isEmailConfigured() {
  const parsed = env();
  return Boolean(parsed.RESEND_API_KEY && parsed.ALERT_FROM_EMAIL);
}
