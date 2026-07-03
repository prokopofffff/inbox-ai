import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import { env, hasSupabase } from "@/lib/env";

/**
 * Route path prefixes that require an authenticated user. Everything else
 * (marketing, /login, /auth callbacks, API, static assets) is public.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/inbox",
  "/automation",
  "/settings",
];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Refreshes the Supabase auth session on every request and gates protected
 * routes.
 *
 * IMPORTANT: this returns a `NextResponse` whose cookies were mutated in place
 * by the Supabase client so refreshed tokens are persisted to the browser. Do
 * not construct a brand-new response and drop these cookies, or sessions will
 * silently fail to refresh.
 *
 * When Supabase is not configured (`hasSupabase === false`) we run in dev/mock
 * mode and let every request through untouched.
 */
export async function updateSession(
  request: NextRequest,
): Promise<NextResponse> {
  // Dev / mock mode: no auth wiring, allow everything.
  if (!hasSupabase) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL!,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  // Do not run code between createServerClient and getUser(): getUser()
  // triggers the token refresh that the setAll callback persists.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && isProtectedPath(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    // Preserve the intended destination for post-login redirect.
    loginUrl.searchParams.set("redirectTo", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
