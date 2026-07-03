import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

import { env, hasSupabase } from "@/lib/env";

/**
 * Server-side Supabase client for Server Components, Server Actions, and Route
 * Handlers.
 *
 * Uses Next.js async `cookies()` (Next 15/16). Writing cookies from a Server
 * Component throws — we swallow that error because session refresh is handled
 * by the proxy/middleware layer, which is allowed to set cookies.
 *
 * When Supabase is not configured, harmless placeholder values keep imports
 * from crashing so the app renders against mock data. Guard real auth calls
 * with `hasSupabase`.
 */
export async function createClient() {
  const cookieStore = await cookies();

  const url = env.NEXT_PUBLIC_SUPABASE_URL ?? "http://localhost:54321";
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "public-anon-key";

  return createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Called from a Server Component where cookies are read-only.
          // Safe to ignore: session refresh runs in the proxy/middleware.
        }
      },
    },
  });
}

export { hasSupabase };
