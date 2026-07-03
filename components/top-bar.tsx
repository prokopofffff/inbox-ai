"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  MenuIcon,
  LogOutIcon,
  UserIcon,
  SettingsIcon,
  ChevronsUpDownIcon,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  SidebarBrand,
  SidebarNav,
  SidebarUser,
} from "@/components/app-sidebar";
import { createClient, hasSupabase } from "@/lib/supabase/client";
import type { UserSummary } from "@/lib/types";

function initialsFor(user: Pick<UserSummary, "name" | "email">): string {
  const source = user.name?.trim() || user.email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  const letters = (parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "");
  return (letters || source[0] || "?").toUpperCase();
}

function useSignOut() {
  const router = useRouter();
  const [signingOut, setSigningOut] = React.useState(false);

  const onSignOut = React.useCallback(async () => {
    setSigningOut(true);
    try {
      if (hasSupabase) {
        const supabase = createClient();
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
      }
      router.push("/login");
      router.refresh();
    } catch {
      toast.error("Could not sign out. Please try again.");
      setSigningOut(false);
    }
  }, [router]);

  return { signingOut, onSignOut };
}

function UserMenuItems({
  user,
  signingOut,
  onSignOut,
}: {
  user: UserSummary;
  signingOut: boolean;
  onSignOut: () => void;
}) {
  return (
    <>
      <DropdownMenuLabel>
        <div className="flex flex-col">
          <span className="text-sm font-medium">{user.name ?? "Account"}</span>
          <span className="truncate text-xs font-normal text-text-secondary">
            {user.email}
          </span>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem render={<Link href="/settings" />}>
        <UserIcon className="size-4" />
        Profile
      </DropdownMenuItem>
      <DropdownMenuItem render={<Link href="/settings" />}>
        <SettingsIcon className="size-4" />
        Settings
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        variant="destructive"
        disabled={signingOut}
        onClick={(e) => {
          e.preventDefault();
          onSignOut();
        }}
      >
        <LogOutIcon className="size-4" />
        {signingOut ? "Signing out…" : "Sign out"}
      </DropdownMenuItem>
    </>
  );
}

/**
 * Desktop sidebar footer: user cell (avatar + name + email) with a chevron
 * trigger that opens the account menu. Rendered inside {@link AppSidebar}.
 */
export function SidebarUserMenu({ user }: { user: UserSummary }) {
  const { signingOut, onSignOut } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <button
            type="button"
            aria-label="Open account menu"
            className="w-full text-left outline-none transition-colors hover:bg-bg-hover focus-visible:bg-bg-hover"
          />
        }
      >
        <SidebarUser
          name={user.name ?? "Account"}
          email={user.email}
          initials={initialsFor(user)}
          action={
            <ChevronsUpDownIcon className="size-4 shrink-0 text-text-tertiary" />
          }
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" className="w-56">
        <UserMenuItems
          user={user}
          signingOut={signingOut}
          onSignOut={() => void onSignOut()}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MobileUserMenu({ user }: { user: UserSummary }) {
  const { signingOut, onSignOut } = useSignOut();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Open user menu"
          />
        }
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
          {initialsFor(user)}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <UserMenuItems
          user={user}
          signingOut={signingOut}
          onSignOut={() => void onSignOut()}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Mobile-only top bar: nav trigger (opens the sheet), brand, theme toggle, and
 * account menu. Hidden on desktop, where navigation and the account menu live
 * in the persistent sidebar. Sticky within the content column.
 */
export function TopBar({ user }: { user: UserSummary }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:hidden">
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Open navigation"
            />
          }
        >
          <MenuIcon className="size-5" />
        </SheetTrigger>
        <SheetContent side="left" className="w-64 bg-bg-subtle p-0">
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <div className="flex h-fit items-center px-5 py-6">
            <SidebarBrand />
          </div>
          <div className="px-3 py-2">
            <SidebarNav onNavigate={() => setMobileOpen(false)} />
          </div>
        </SheetContent>
      </Sheet>

      <div className="flex flex-1 items-center">
        <SidebarBrand />
      </div>

      <div className="flex items-center gap-1">
        <ThemeToggle />
        <MobileUserMenu user={user} />
      </div>
    </header>
  );
}
