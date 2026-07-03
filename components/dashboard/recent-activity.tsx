import Link from "next/link";
import { formatDistanceToNowStrict } from "date-fns";
import { ArrowRight, MailOpen } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  CategoryBadge,
  PriorityBadge,
} from "@/components/dashboard/badges";
import { cn } from "@/lib/utils";
import type { EmailWithClassification } from "@/lib/types";

/**
 * Recent Activity — the latest classified emails.
 *
 * Renders as a table on md+ and collapses to stacked rows on small screens.
 * Each row surfaces sender (tinted avatar + name/email), a muted subject
 * preview, the AI category/priority badges, and a relative timestamp.
 */

/** Rotating tinted avatar palette (matches the design reference). */
const AVATAR_TONES = [
  "bg-[var(--accent-subtle)] text-[var(--accent)]",
  "bg-[var(--purple-subtle)] text-[var(--purple)]",
  "bg-[var(--success-subtle)] text-[var(--success)]",
  "bg-[var(--warning-subtle)] text-[var(--warning)]",
  "bg-[var(--danger-subtle)] text-[var(--danger)]",
];

function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

function initials(name: string | null, email: string): string {
  const source = name?.trim() || email;
  const parts = source.split(/[\s@._-]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function timeAgo(date: Date): string {
  try {
    return formatDistanceToNowStrict(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
}

export function RecentActivity({
  emails,
}: {
  emails: EmailWithClassification[];
}) {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-card shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A]">
      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold tracking-[-0.01em] text-[var(--text-primary)]">
            Recent Activity
          </h3>
          <p className="text-[13px] text-[var(--text-secondary)]">
            Latest emails classified by AI
          </p>
        </div>
        <Link
          href="/inbox"
          className="inline-flex shrink-0 items-center gap-1.5 text-[13px] font-semibold text-[var(--accent)] hover:underline"
        >
          View all
          <ArrowRight className="size-[15px]" aria-hidden />
        </Link>
      </div>

      {emails.length === 0 ? (
        <EmptyActivity />
      ) : (
        <>
          {/* Table (md and up) */}
          <div className="hidden md:block">
            {/* Column head */}
            <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-subtle)] px-5 py-2.5 text-[11px] font-semibold tracking-[0.04em] text-[var(--text-tertiary)]">
              <div className="w-[220px] shrink-0">SENDER</div>
              <div className="flex-1">SUBJECT</div>
              <div className="w-[128px] shrink-0">CATEGORY</div>
              <div className="w-[112px] shrink-0">PRIORITY</div>
              <div className="w-[78px] shrink-0 text-right">TIME</div>
            </div>
            {emails.map((email, i) => (
              <div
                key={email.id}
                className={cn(
                  "flex items-center gap-4 px-5 py-3",
                  i < emails.length - 1 && "border-b border-[var(--border)]",
                )}
              >
                <div className="w-[220px] shrink-0">
                  <SenderCell email={email} />
                </div>
                <div className="flex-1 truncate text-[13px] text-[var(--text-secondary)]">
                  {email.subject || "(no subject)"}
                </div>
                <div className="w-[128px] shrink-0">
                  {email.classification ? (
                    <CategoryBadge category={email.classification.category} />
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">—</span>
                  )}
                </div>
                <div className="w-[112px] shrink-0">
                  {email.classification ? (
                    <PriorityBadge priority={email.classification.priority} />
                  ) : (
                    <span className="text-xs text-[var(--text-tertiary)]">—</span>
                  )}
                </div>
                <div className="w-[78px] shrink-0 text-right text-xs whitespace-nowrap text-[var(--text-tertiary)]">
                  {timeAgo(email.receivedAt)}
                </div>
              </div>
            ))}
          </div>

          {/* Stacked rows (small screens) */}
          <ul className="flex flex-col md:hidden">
            {emails.map((email, i) => (
              <li
                key={email.id}
                className={cn(
                  "flex flex-col gap-2 px-5 py-3",
                  i < emails.length - 1 && "border-b border-[var(--border)]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <SenderCell email={email} />
                  <span className="shrink-0 text-xs whitespace-nowrap text-[var(--text-tertiary)]">
                    {timeAgo(email.receivedAt)}
                  </span>
                </div>
                <p className="truncate text-[13px] text-[var(--text-secondary)]">
                  {email.subject || "(no subject)"}
                </p>
                {email.classification ? (
                  <div className="flex flex-wrap gap-1.5">
                    <CategoryBadge category={email.classification.category} />
                    <PriorityBadge priority={email.classification.priority} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function SenderCell({ email }: { email: EmailWithClassification }) {
  const tone = avatarTone(email.fromName || email.fromAddr);
  return (
    <div className="flex items-center gap-2.5">
      <span
        className={cn(
          "flex size-[34px] shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          tone,
        )}
      >
        {initials(email.fromName, email.fromAddr)}
      </span>
      <span className="grid min-w-0">
        <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
          {email.fromName || email.fromAddr}
        </span>
        <span className="truncate text-xs text-[var(--text-tertiary)]">
          {email.fromAddr}
        </span>
      </span>
    </div>
  );
}

function EmptyActivity() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <span className="flex size-10 items-center justify-center rounded-full bg-[var(--bg-subtle)]">
        <MailOpen className="size-5 text-[var(--text-tertiary)]" aria-hidden />
      </span>
      <p className="text-sm font-medium text-[var(--text-primary)]">
        No classified emails yet
      </p>
      <p className="max-w-xs text-xs text-[var(--text-secondary)]">
        Once the pipeline processes incoming mail, the most recent
        classifications will appear here.
      </p>
    </div>
  );
}

export function RecentActivitySkeleton() {
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[var(--border)] bg-card shadow-[0px_1px_2px_0px_#1018280F,_0px_4px_12px_-2px_#1018280A]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div className="flex flex-col gap-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-4 w-16" />
      </div>
      <div className="flex flex-col">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b border-[var(--border)] px-5 py-3 last:border-b-0"
          >
            <Skeleton className="size-[34px] shrink-0 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
            <Skeleton className="hidden h-5 w-16 rounded-full sm:block" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  );
}
