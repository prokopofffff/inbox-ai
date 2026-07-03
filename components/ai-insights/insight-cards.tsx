import * as React from "react";
import {
  CircleAlert,
  Flag,
  MessageSquareReply,
  MessagesSquare,
  Repeat2,
  Siren,
  Sparkles,
  Timer,
  TrendingDown,
  Zap,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  InsightsData,
  RankedItem,
  ResponseMetric,
  Suggestion,
  UrgentCase,
} from "@/components/ai-insights/data";

/**
 * AI Insights cards.
 *
 * Light-theme SaaS cards matching the design export: rounded-2xl white surface,
 * soft shadow, a tinted icon box in the header, and per-card body layouts.
 * Colors come from the shared token CSS vars so dark mode is derived, not baked.
 */

// ---------------------------------------------------------------------------
// Shared card shell
// ---------------------------------------------------------------------------

const CARD =
  "flex flex-col gap-[18px] rounded-2xl border border-border bg-card p-[22px] " +
  "shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A]";

type IconTone = "danger" | "accent" | "warning" | "success" | "purple";

const ICON_BOX_TONE: Record<IconTone, string> = {
  danger: "bg-danger-subtle text-danger",
  accent: "bg-accent-subtle text-[var(--accent-foreground)]",
  warning: "bg-warning-subtle text-warning",
  success: "bg-success-subtle text-success",
  purple: "bg-purple-subtle text-purple",
};

function CardHead({
  icon: Icon,
  tone,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>;
  tone: IconTone;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex w-full items-center gap-3">
      <div
        className={cn(
          "flex size-[38px] shrink-0 items-center justify-center rounded-lg",
          ICON_BOX_TONE[tone],
        )}
      >
        <Icon className="size-[19px]" aria-hidden />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="text-[15px] font-semibold tracking-[-0.2px] text-foreground">
          {title}
        </div>
        <div className="text-xs text-text-tertiary">{subtitle}</div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked list with mini horizontal bars (Top Customer Issues)
// ---------------------------------------------------------------------------

function BarList({ items, barColor }: { items: RankedItem[]; barColor: string }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className="flex w-full flex-col gap-[15px]">
      {items.map((item) => (
        <div key={item.label} className="flex w-full flex-col gap-2">
          <div className="flex w-full items-center gap-2.5">
            <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
              {item.label}
            </div>
            <div className="shrink-0 text-[13px] font-semibold text-text-secondary">
              {item.count}
            </div>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(6, Math.round((item.count / max) * 100))}%`,
                backgroundColor: barColor,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TopIssuesCard({ items }: { items: RankedItem[] }) {
  return (
    <div className={CARD}>
      <CardHead
        icon={CircleAlert}
        tone="danger"
        title="Top Customer Issues"
        subtitle="Most reported problems"
      />
      <BarList items={items} barColor="var(--danger)" />
    </div>
  );
}

export function RepeatedComplaintsCard({ items }: { items: RankedItem[] }) {
  return (
    <div className={CARD}>
      <CardHead
        icon={Repeat2}
        tone="warning"
        title="Repeated Complaints"
        subtitle="Recurring negative feedback"
      />
      <BarList items={items} barColor="var(--warning)" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Ranked list with percent bars (Most Common Questions)
// ---------------------------------------------------------------------------

export function CommonQuestionsCard({ items }: { items: RankedItem[] }) {
  const total = Math.max(1, items.reduce((sum, i) => sum + i.count, 0));
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div className={CARD}>
      <CardHead
        icon={MessagesSquare}
        tone="accent"
        title="Most Common Questions"
        subtitle="What users ask about"
      />
      <div className="flex w-full flex-col gap-[15px]">
        {items.map((item) => (
          <div key={item.label} className="flex w-full flex-col gap-2">
            <div className="flex w-full items-center gap-2.5">
              <div className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">
                {item.label}
              </div>
              <div className="shrink-0 text-[13px] font-semibold text-text-secondary">
                {Math.round((item.count / total) * 100)}%
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg-hover">
              <div
                className="h-full rounded-full bg-[var(--accent-foreground)]"
                style={{
                  width: `${Math.max(6, Math.round((item.count / max) * 100))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Urgent Cases
// ---------------------------------------------------------------------------

const SEVERITY: Record<
  UrgentCase["severity"],
  { label: string; chip: string; dot: string }
> = {
  critical: {
    label: "Critical",
    chip: "bg-danger-subtle text-danger",
    dot: "bg-danger",
  },
  high: {
    label: "High",
    chip: "bg-warning-subtle text-warning",
    dot: "bg-warning",
  },
};

export function UrgentCasesCard({ cases }: { cases: UrgentCase[] }) {
  return (
    <div className={CARD}>
      <CardHead
        icon={Siren}
        tone="danger"
        title="Urgent Cases"
        subtitle="Needs immediate attention"
      />
      <div className="flex w-full flex-col gap-2.5">
        {cases.map((c, i) => {
          const sev = SEVERITY[c.severity];
          return (
            <div
              key={`${c.title}-${i}`}
              className="flex w-full items-center gap-3 rounded-xl bg-bg-subtle p-3"
            >
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <div className="truncate text-[13px] font-semibold text-foreground">
                  {c.title}
                </div>
                <div className="truncate text-xs text-text-tertiary">
                  {c.meta}
                </div>
              </div>
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1",
                  sev.chip,
                )}
              >
                <span className={cn("size-[7px] rounded-full", sev.dot)} />
                <span className="text-xs font-semibold">{sev.label}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Average Response Time
// ---------------------------------------------------------------------------

export function ResponseTimeCard({
  data,
}: {
  data: InsightsData["responseTime"];
}) {
  return (
    <div className={CARD}>
      <CardHead
        icon={Timer}
        tone="success"
        title="Average Response Time"
        subtitle="Team performance"
      />
      <div className="flex w-full flex-col gap-1.5">
        <div className="text-[38px] font-semibold leading-none tracking-[-1px] text-foreground">
          {data.average}
        </div>
        <div className="flex items-center gap-1.5">
          <TrendingDown className="size-4 text-success" aria-hidden />
          <span className="text-[13px] font-semibold text-success">
            {data.trendPct}% faster
          </span>
          <span className="text-[13px] text-text-tertiary">than last month</span>
        </div>
      </div>
      <div className="h-px w-full bg-border" />
      <div className="flex w-full flex-col gap-3">
        {data.metrics.map((m: ResponseMetric) => (
          <div
            key={m.label}
            className="flex w-full items-center justify-between"
          >
            <span className="text-[13px] text-text-secondary">{m.label}</span>
            <span className="text-[13px] font-semibold text-foreground">
              {m.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AI Suggestions
// ---------------------------------------------------------------------------

const SUGGESTION_ICON: Record<
  Suggestion["icon"],
  React.ComponentType<{ className?: string }>
> = {
  zap: Zap,
  reply: MessageSquareReply,
  flag: Flag,
};

export function SuggestionsCard({ items }: { items: Suggestion[] }) {
  return (
    <div className={CARD}>
      <CardHead
        icon={Sparkles}
        tone="purple"
        title="AI Suggestions"
        subtitle="Recommended automations"
      />
      <div className="flex w-full flex-col gap-2.5">
        {items.map((s, i) => {
          const Icon = SUGGESTION_ICON[s.icon] ?? Flag;
          return (
            <div
              key={i}
              className="flex w-full items-center gap-[11px] rounded-xl bg-purple-subtle p-3"
            >
              <div className="flex size-[26px] shrink-0 items-center justify-center rounded-lg bg-card">
                <Icon className="size-3.5 text-purple" aria-hidden />
              </div>
              <p className="flex-1 text-[13px] leading-[18px] text-foreground">
                {s.text}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
