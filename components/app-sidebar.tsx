"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  InboxIcon,
  SparklesIcon,
  GitBranchIcon,
  SettingsIcon,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
}

/** Primary navigation, shared by the desktop sidebar and the mobile sheet. */
export const NAV_ITEMS: NavItem[] = [
  { title: "Dashboard", href: "/", icon: LayoutDashboardIcon },
  { title: "Inbox", href: "/inbox", icon: InboxIcon },
  { title: "AI Insights", href: "/ai-insights", icon: SparklesIcon },
  { title: "Rules", href: "/automation", icon: GitBranchIcon },
  { title: "Settings", href: "/settings", icon: SettingsIcon },
];

/** True when `href` matches the current path (exact for "/", prefix otherwise). */
export function isActivePath(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SidebarBrand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
    >
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <SparklesIcon className="size-5" />
      </span>
      <span className="text-[17px] font-semibold tracking-[-0.3px] text-foreground">
        Inbox AI
      </span>
    </Link>
  );
}

export function SidebarNav({
  onNavigate,
  className,
}: {
  /** Called after a link is clicked (used to close the mobile sheet). */
  onNavigate?: () => void;
  className?: string;
}) {
  const pathname = usePathname();

  return (
    <nav className={cn("flex flex-col gap-0.5", className)}>
      {NAV_ITEMS.map((item) => {
        const active = isActivePath(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
              active
                ? "bg-accent font-semibold text-accent-foreground"
                : "font-medium text-text-secondary hover:bg-bg-hover hover:text-foreground"
            )}
          >
            <Icon className="size-[18px] shrink-0" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}

/** Bottom user cell: avatar + name + email. Used in the sidebar and mobile sheet. */
export function SidebarUser({
  name,
  email,
  initials,
  action,
}: {
  name: string;
  email: string;
  initials: string;
  /** Optional trailing control (e.g. a menu trigger with a chevron). */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 border-t border-border px-4 pb-[18px] pt-3.5">
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-[13px] font-semibold text-accent-foreground">
        {initials}
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-[13px] font-semibold text-foreground">
          {name}
        </span>
        <span className="truncate text-xs text-text-secondary">{email}</span>
      </div>
      {action}
    </div>
  );
}

/** Desktop sidebar. Hidden on small screens (mobile uses a Sheet). */
export function AppSidebar({
  className,
  footer,
}: {
  className?: string;
  /** Bottom user cell (rendered by the layout so it can wire up the menu). */
  footer?: React.ReactNode;
}) {
  return (
    <aside
      className={cn(
        "hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-border md:bg-bg-subtle",
        className
      )}
    >
      <div className="flex h-fit items-center px-5 py-6">
        <SidebarBrand />
      </div>
      <div className="flex-1 overflow-y-auto px-3 py-2">
        <SidebarNav />
      </div>
      {footer}
    </aside>
  );
}
