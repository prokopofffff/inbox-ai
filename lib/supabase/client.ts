import { createBrowserClient } from "@supabase/ssr";

import { env, hasSupabase } from "@/lib/env";

/**
 * Browser-side Supabase client (client components).
 *
 * When Supabase is not configured we still construct a client with harmless
 * placeholder values so imports never crash during local/mock development.
 * Guard real auth calls with `hasSupabase` at the call site.
 */
export function createClient() {
  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key";

  return createBrowserClient(url, anonKey);
}

export { hasSupabase };
