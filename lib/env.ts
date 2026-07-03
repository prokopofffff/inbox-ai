/**
 * Safe environment access.
 *
 * External integrations (OpenAI, Gmail/Google, Supabase) must degrade
 * gracefully when keys are absent so the app can run and render locally
 * against seeded/mock data. This module never throws at import time — it
 * only reads `process.env` and exposes typed helpers plus feature flags.
 */

function read(key: string): string | undefined {
  const value = process.env[key];
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  return trimmed;
}

/**
 * A value is considered a "real" credential only when it is present and does
 * not look like one of the placeholder values from `.env.example`.
 */
function isConfigured(value: string | undefined): value is string {
  if (!value) return false;
  const lower = value.toLowerCase();
  const placeholderPrefixes = [
    "your-",
    "your_",
    "sk-...",
    "changeme",
    "replace-me",
    "todo",
  ];
  return !placeholderPrefixes.some((p) => lower === p || lower.startsWith(p));
}

export const env = {
  // Database
  DATABASE_URL: read("DATABASE_URL"),
  DIRECT_URL: read("DIRECT_URL"),

  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: read("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: read("SUPABASE_SERVICE_ROLE_KEY"),

  // OpenAI
  OPENAI_API_KEY: read("OPENAI_API_KEY"),
  OPENAI_MODEL: read("OPENAI_MODEL") ?? "gpt-4o-mini",

  // Google / Gmail
  GOOGLE_CLIENT_ID: read("GOOGLE_CLIENT_ID"),
  GOOGLE_CLIENT_SECRET: read("GOOGLE_CLIENT_SECRET"),
  GOOGLE_REDIRECT_URI:
    read("GOOGLE_REDIRECT_URI") ??
    "http://localhost:3000/api/auth/gmail/callback",

  // Cron
  CRON_SECRET: read("CRON_SECRET"),

  // App
  NODE_ENV: process.env.NODE_ENV ?? "development",
  APP_URL: read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
} as const;

/**
 * Individual feature availability booleans.
 *
 * Prefer these named exports (`hasSupabase`, `hasOpenAI`, `hasGoogle`) in app
 * code to decide between real external calls and seeded/mock data.
 */

/** True when Supabase public URL + anon key are present (auth + browser client). */
export const hasSupabase =
  isConfigured(env.NEXT_PUBLIC_SUPABASE_URL) &&
  isConfigured(env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

/** True when the Supabase service-role key is additionally present. */
export const hasSupabaseAdmin =
  hasSupabase && isConfigured(env.SUPABASE_SERVICE_ROLE_KEY);

/** True when a usable OpenAI key is present; otherwise use the mock classifier. */
export const hasOpenAI = isConfigured(env.OPENAI_API_KEY);

/** True when Google OAuth creds are present; otherwise use the mock Gmail client. */
export const hasGoogle =
  isConfigured(env.GOOGLE_CLIENT_ID) && isConfigured(env.GOOGLE_CLIENT_SECRET);

/** True when a real database connection string is present. */
export const hasDatabase = isConfigured(env.DATABASE_URL);

/** True when a cron secret is configured (the endpoint should enforce it). */
export const hasCronSecret = isConfigured(env.CRON_SECRET);

/** True when every external integration is wired up for real. */
export const isFullyConfigured =
  hasSupabase && hasOpenAI && hasGoogle && hasDatabase;

/**
 * Grouped feature flags. Kept for callers that prefer a namespaced object.
 * Values mirror the individual `hasX` exports above.
 */
export const features = {
  supabase: hasSupabase,
  supabaseAdmin: hasSupabaseAdmin,
  openai: hasOpenAI,
  gmail: hasGoogle,
  database: hasDatabase,
  cron: hasCronSecret,
} as const;

export type Env = typeof env;
export type Features = typeof features;
