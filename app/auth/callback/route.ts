import { NextResponse, type NextRequest } from "next/server";

import { createClient, hasSupabase } from "@/lib/supabase/server";

/**
 * Supabase auth callback handler.
 *
 * Handles the OAuth / magic-link / email-confirmation redirect: exchanges the
 * `code` query param for a session (setting auth cookies) and then redirects to
 * the requested `next` path (defaulting to "/").
 *
 * In demo mode (Supabase not configured) there is nothing to exchange, so we
 * simply redirect onward.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  // Guard against open-redirects: only allow same-origin relative paths.
  // Reject protocol-relative ("//evil.com") and backslash ("/\\evil.com")
  // forms — the browser/URL parser resolves those to a different origin.
  const redirectPath = isSafeRelativePath(next) ? next : "/";

  if (hasSupabase && code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      const url = new URL("/login", origin);
      url.searchParams.set("error", error.message);
      return NextResponse.redirect(url);
    }
  }

  return NextResponse.redirect(new URL(redirectPath, origin));
}

/**
 * A safe post-auth redirect target is a same-origin absolute path: it must
 * start with a single "/" and not begin with "//" or "/\\", both of which the
 * URL parser treats as protocol-relative (cross-origin) URLs.
 */
function isSafeRelativePath(path: string): boolean {
  return (
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.startsWith("/\\")
  );
}
