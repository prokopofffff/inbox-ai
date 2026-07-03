import { type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/middleware";

/**
 * Root middleware: refresh the Supabase session and gate protected routes
 * (/dashboard, /inbox, /automation, /settings). In dev/mock mode (no Supabase
 * configured) `updateSession` passes every request through.
 *
 * Note: in Next.js 16 the `middleware` convention is deprecated in favour of
 * `proxy.ts`, but `middleware.ts` remains supported and is used here per the
 * project spec.
 */
export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api routes (handle their own auth, e.g. cron secret)
     * - common static asset extensions
     * Feel free to modify this pattern to include more paths.
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)$).*)",
  ],
};
