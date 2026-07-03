import type { Role, User } from "@prisma/client";

import { hasSupabase } from "@/lib/env";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

/**
 * The application user, joined from Supabase auth (uid -> `User.supabaseId`)
 * to the Prisma `User` row. Includes the resolved email from Supabase for
 * convenience.
 */
export type CurrentUser = User;

/**
 * Deterministic mock user returned when Supabase is not configured, so the app
 * renders end-to-end against seeded/mock data without real auth.
 */
export const MOCK_USER: CurrentUser = {
  id: "mock-user",
  email: "demo@inbox-ai.dev",
  name: "Demo User",
  role: "OWNER" as Role,
  supabaseId: "mock-supabase-uid",
  orgId: "mock-org",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

/**
 * Returns the current application user, or `null` when unauthenticated.
 *
 * Behaviour:
 * - Supabase not configured (dev/mock mode): returns {@link MOCK_USER}.
 * - Supabase configured: verifies the session via `getUser()`, then looks up
 *   the matching Prisma `User` by `supabaseId`. Returns `null` when there is no
 *   session, and gracefully returns `null` on DB/lookup errors.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!hasSupabase) {
    return MOCK_USER;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  try {
    const appUser = await prisma.user.findUnique({
      where: { supabaseId: user.id },
    });
    return appUser;
  } catch {
    // DB unavailable or user row not yet provisioned — treat as unauthenticated
    // rather than crashing the request.
    return null;
  }
}

/**
 * Like {@link getCurrentUser} but throws when there is no authenticated user.
 * Use in server actions / route handlers that must have a user.
 */
export async function requireCurrentUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("UNAUTHENTICATED");
  }
  return user;
}

/** Convenience role check helpers. */
export function isAdmin(user: Pick<CurrentUser, "role">): boolean {
  return user.role === "OWNER" || user.role === "ADMIN";
}

export function isOwner(user: Pick<CurrentUser, "role">): boolean {
  return user.role === "OWNER";
}
