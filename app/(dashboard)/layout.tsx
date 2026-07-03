import * as React from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { TopBar, SidebarUserMenu } from "@/components/top-bar";
import { getCurrentUser } from "@/lib/auth";
import type { UserSummary } from "@/lib/types";

/**
 * Authenticated dashboard shell.
 *
 * Composes the desktop sidebar + top bar (with mobile Sheet nav) around the
 * routed content. Resolves the current user server-side; in mock mode
 * (`getCurrentUser` returns MOCK_USER) the app renders end-to-end without real
 * auth. Middleware handles redirecting unauthenticated users when Supabase is
 * configured, so we fall back to a lightweight placeholder identity here rather
 * than throwing.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const current = await getCurrentUser();

  const user: UserSummary = current
    ? {
        id: current.id,
        email: current.email,
        name: current.name,
        role: current.role,
      }
    : {
        id: "guest",
        email: "guest@inbox-ai.dev",
        name: "Guest",
        role: "MEMBER",
      };

  return (
    <div className="flex min-h-svh w-full bg-bg-subtle">
      <AppSidebar footer={<SidebarUserMenu user={user} />} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar user={user} />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
