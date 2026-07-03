import {
  CircleCheckBig,
  Flag,
  Hourglass,
  Mail,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardStats } from "@/lib/types";

/**
 * Headline metric cards: Total Emails Today, High Priority, Waiting for Reply,
 * Automatically Resolved.
 *
 * Each card shows a muted label + a subtle tinted icon box, a large count, and
 * a small delta line comparing to the previous period (green ↑ / red ↓). The
 * layout mirrors the design reference (rounded-16 white cards, 1px border,
 * subtle shadow).
 */

interface StatConfig {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
  /** Tailwind classes for the tinted icon box (bg + icon color). */
  iconBoxClass: string;
  iconClass: string;
  /** Percentage/absolute change vs. previous period, if known. */
  delta?: number;
  /** Render the delta as a raw count ("+8", "-5") instead of a percentage. */
  deltaAsCount?: boolean;
  /** How to interpret a positive delta: "up" is good (green) or bad (red). */
  positiveIsGood?: boolean;
  /** Trailing helper text after the delta. */
  hint: string;
  /** Force the delta color regardless of direction (design uses red for
   *  "High Priority" +8). */
  forceTone?: "good" | "bad";
}

export function StatCards({ stats }: { stats: DashboardStats }) {
  const cards: StatConfig[] = [
    {
      key: "emails",
      label: "Total Emails Today",
      value: stats.totalEmails,
      icon: Mail,
      iconBoxClass: "bg-[var(--accent-subtle)]",
      iconClass: "text-[var(--accent)]",
      delta: stats.deltas?.totalEmails,
      positiveIsGood: true,
      hint: "vs yesterday",
    },
    {
      key: "high",
      label: "High Priority",
      value: stats.urgent,
      icon: Flag,
      iconBoxClass: "bg-[var(--danger-subtle)]",
      iconClass: "text-[var(--danger)]",
      delta: stats.deltas?.urgent,
      deltaAsCount: true,
      hint: "needs attention",
      forceTone: "bad",
    },
    {
      key: "waiting",
      label: "Waiting for Reply",
      value: stats.unread,
      icon: Hourglass,
      iconBoxClass: "bg-[var(--warning-subtle)]",
      iconClass: "text-[var(--warning)]",
      delta: stats.deltas?.unread,
      deltaAsCount: true,
      positiveIsGood: false,
      hint: "vs yesterday",
    },
    {
      key: "resolved",
      label: "Automatically Resolved",
      value: stats.openTasks,
      icon: CircleCheckBig,
      iconBoxClass: "bg-[var(--success-subtle)]",
      iconClass: "text-[var(--success)]",
      delta: stats.deltas?.openTasks,
      positiveIsGood: true,
      hint: "vs yesterday",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(({ key, ...card }) => (
        <StatCard key={key} {...card} />
      ))}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  iconBoxClass,
  iconClass,
  delta,
  deltaAsCount = false,
  positiveIsGood = true,
  hint,
  forceTone,
}: Omit<StatConfig, "key">) {
  const hasDelta = typeof delta === "number" && Number.isFinite(delta);
  const isUp = hasDelta && delta! > 0;
  const isDown = hasDelta && delta! < 0;

  // Good = green, bad = red, based on direction + positiveIsGood (unless forced).
  const tone: "good" | "bad" | "neutral" = forceTone
    ? forceTone
    : hasDelta && delta !== 0
      ? isUp === positiveIsGood
        ? "good"
        : "bad"
      : "neutral";

  const TrendIcon = isDown ? TrendingDown : TrendingUp;
  const toneClass =
    tone === "good"
      ? "text-[var(--success)]"
      : tone === "bad"
        ? "text-[var(--danger)]"
        : "text-[var(--text-secondary)]";

  const deltaText = hasDelta
    ? deltaAsCount
      ? `${delta! > 0 ? "+" : ""}${delta}`
      : `${delta! > 0 ? "+" : ""}${delta}%`
    : null;

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border border-[var(--border)] bg-card p-5 shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A]">
      <div className="flex items-center justify-between">
        <span className="text-[13px] font-medium text-[var(--text-secondary)]">
          {label}
        </span>
        <span
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-lg",
            iconBoxClass,
          )}
        >
          <Icon className={cn("size-[17px]", iconClass)} aria-hidden />
        </span>
      </div>
      <div className="text-[30px] leading-none font-semibold tracking-[-0.02em] tabular-nums text-[var(--text-primary)]">
        {value.toLocaleString()}
      </div>
      <div className="flex items-center gap-1.5 text-[13px]">
        {deltaText ? (
          <span className={cn("inline-flex items-center gap-1 font-semibold", toneClass)}>
            <TrendIcon className="size-[15px]" aria-hidden />
            {deltaText}
          </span>
        ) : null}
        <span className="font-normal text-[var(--text-tertiary)]">{hint}</span>
      </div>
    </div>
  );
}

export function StatCardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col gap-3.5 rounded-2xl border border-[var(--border)] bg-card p-5 shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A]"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
          <Skeleton className="h-8 w-20" />
          <Skeleton className="h-4 w-28" />
        </div>
      ))}
    </div>
  );
}
