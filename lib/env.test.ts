import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * lib/env.ts derives its feature flags at module-evaluation time from
 * process.env. To test different credential combinations we mutate
 * process.env, reset the module registry, and dynamically re-import the module
 * so the flags recompute.
 */

const CRED_KEYS = [
  "DATABASE_URL",
  "DIRECT_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
  "GOOGLE_CLIENT_ID",
  "GOOGLE_CLIENT_SECRET",
  "GOOGLE_REDIRECT_URI",
  "CRON_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

const original: Record<string, string | undefined> = {};

async function loadEnv(overrides: Record<string, string | undefined>) {
  // Start from a clean slate: strip every credential key.
  for (const k of CRED_KEYS) delete process.env[k];
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  vi.resetModules();
  return import("@/lib/env");
}

beforeEach(() => {
  for (const k of CRED_KEYS) original[k] = process.env[k];
});

afterEach(() => {
  for (const k of CRED_KEYS) {
    if (original[k] === undefined) delete process.env[k];
    else process.env[k] = original[k];
  }
  vi.resetModules();
});

describe("read() normalization via env object", () => {
  it("trims whitespace and treats blank strings as undefined", async () => {
    const mod = await loadEnv({ DATABASE_URL: "  postgres://real  " });
    expect(mod.env.DATABASE_URL).toBe("postgres://real");
    expect(mod.hasDatabase).toBe(true);

    const blank = await loadEnv({ DATABASE_URL: "   " });
    expect(blank.env.DATABASE_URL).toBeUndefined();
    expect(blank.hasDatabase).toBe(false);
  });

  it("applies documented defaults for optional vars", async () => {
    const mod = await loadEnv({});
    expect(mod.env.OPENAI_MODEL).toBe("gpt-4o-mini");
    expect(mod.env.GOOGLE_REDIRECT_URI).toBe(
      "http://localhost:3000/api/auth/gmail/callback",
    );
    expect(mod.env.APP_URL).toBe("http://localhost:3000");
  });

  it("honors overrides for defaulted vars", async () => {
    const mod = await loadEnv({
      OPENAI_MODEL: "gpt-4.1",
      NEXT_PUBLIC_APP_URL: "https://app.example.com",
    });
    expect(mod.env.OPENAI_MODEL).toBe("gpt-4.1");
    expect(mod.env.APP_URL).toBe("https://app.example.com");
  });
});

describe("placeholder detection (isConfigured)", () => {
  const placeholders = [
    "your-openai-key",
    "your_api_key",
    "sk-...redacted",
    "changeme",
    "replace-me",
    "todo",
    "YOUR-VALUE", // case-insensitive
  ];

  it.each(placeholders)("treats %s as unconfigured", async (val) => {
    const mod = await loadEnv({ OPENAI_API_KEY: val });
    expect(mod.hasOpenAI).toBe(false);
  });

  it("treats a real-looking key as configured", async () => {
    const mod = await loadEnv({ OPENAI_API_KEY: "sk-proj-abc123realkey" });
    expect(mod.hasOpenAI).toBe(true);
  });
});

describe("feature flags with all credentials absent (mock mode)", () => {
  it("everything is false", async () => {
    const mod = await loadEnv({});
    expect(mod.hasSupabase).toBe(false);
    expect(mod.hasSupabaseAdmin).toBe(false);
    expect(mod.hasOpenAI).toBe(false);
    expect(mod.hasGoogle).toBe(false);
    expect(mod.hasDatabase).toBe(false);
    expect(mod.hasCronSecret).toBe(false);
    expect(mod.isFullyConfigured).toBe(false);
    expect(mod.features).toEqual({
      supabase: false,
      supabaseAdmin: false,
      openai: false,
      gmail: false,
      database: false,
      cron: false,
    });
  });
});

describe("hasSupabase", () => {
  it("requires BOTH url and anon key", async () => {
    const urlOnly = await loadEnv({ NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co" });
    expect(urlOnly.hasSupabase).toBe(false);

    const keyOnly = await loadEnv({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123" });
    expect(keyOnly.hasSupabase).toBe(false);

    const both = await loadEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
    });
    expect(both.hasSupabase).toBe(true);
  });
});

describe("hasSupabaseAdmin", () => {
  it("requires hasSupabase plus a service-role key", async () => {
    const noService = await loadEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
    });
    expect(noService.hasSupabaseAdmin).toBe(false);

    const withService = await loadEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
    });
    expect(withService.hasSupabaseAdmin).toBe(true);
  });

  it("service key alone (without public creds) is not enough", async () => {
    const mod = await loadEnv({ SUPABASE_SERVICE_ROLE_KEY: "service-role-key" });
    expect(mod.hasSupabaseAdmin).toBe(false);
  });
});

describe("hasGoogle", () => {
  it("requires BOTH client id and secret", async () => {
    const idOnly = await loadEnv({ GOOGLE_CLIENT_ID: "client-id" });
    expect(idOnly.hasGoogle).toBe(false);

    const both = await loadEnv({
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
    });
    expect(both.hasGoogle).toBe(true);
  });
});

describe("hasDatabase & hasCronSecret", () => {
  it("derive from their single vars", async () => {
    const mod = await loadEnv({ DATABASE_URL: "postgres://db", CRON_SECRET: "s3cret" });
    expect(mod.hasDatabase).toBe(true);
    expect(mod.hasCronSecret).toBe(true);
  });
});

describe("isFullyConfigured", () => {
  it("is true only when supabase + openai + google + database are all real", async () => {
    const mod = await loadEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
      OPENAI_API_KEY: "sk-proj-real",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      DATABASE_URL: "postgres://db",
    });
    expect(mod.isFullyConfigured).toBe(true);
    expect(mod.features.supabase).toBe(true);
    expect(mod.features.openai).toBe(true);
    expect(mod.features.gmail).toBe(true);
    expect(mod.features.database).toBe(true);
  });

  it("is false when any one integration is missing", async () => {
    const mod = await loadEnv({
      NEXT_PUBLIC_SUPABASE_URL: "https://x.supabase.co",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key-123",
      OPENAI_API_KEY: "sk-proj-real",
      GOOGLE_CLIENT_ID: "client-id",
      GOOGLE_CLIENT_SECRET: "client-secret",
      // DATABASE_URL intentionally absent
    });
    expect(mod.isFullyConfigured).toBe(false);
  });
});
