import type { Metadata } from "next";
import { Inbox as InboxIcon, MailOpen } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { hasDatabase } from "@/lib/env";
import { getMockEmails } from "@/lib/mock-emails";
import {
  CATEGORY_VALUES,
  PRIORITY_VALUES,
  EMAIL_STATUS_VALUES,
} from "@/lib/schemas";
import type {
  Category,
  Priority,
  EmailStatus,
  EmailWithClassification,
} from "@/lib/types";
import { EmailList } from "@/components/inbox/email-list";
import { InboxPagination } from "@/components/inbox/pagination";

export const metadata: Metadata = {
  title: "Inbox · Inbox AI",
  description: "AI-triaged and prioritized email inbox.",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 15;

type SearchParams = Record<string, string | string[] | undefined>;

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parseEnum<T extends string>(
  value: string | undefined,
  allowed: readonly T[]
): T | undefined {
  if (!value) return undefined;
  const upper = value.toUpperCase() as T;
  return allowed.includes(upper) ? upper : undefined;
}

export default async function InboxPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;

  const q = first(sp.q)?.trim() || undefined;
  const priority = parseEnum<Priority>(first(sp.priority), PRIORITY_VALUES);
  const category = parseEnum<Category>(first(sp.category), CATEGORY_VALUES);
  const status = parseEnum<EmailStatus>(first(sp.status), EMAIL_STATUS_VALUES);

  const rawPage = Number.parseInt(first(sp.page) ?? "1", 10);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;

  // Build the Prisma where clause from the active filters.
  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (priority || category) {
    where.classification = {
      ...(priority ? { priority } : {}),
      ...(category ? { category } : {}),
    };
  }
  if (q) {
    where.OR = [
      { subject: { contains: q, mode: "insensitive" } },
      { snippet: { contains: q, mode: "insensitive" } },
      { fromName: { contains: q, mode: "insensitive" } },
      { fromAddr: { contains: q, mode: "insensitive" } },
    ];
  }

  let emails: EmailWithClassification[] = [];
  let total = 0;
  let unread = 0;
  let loadError: string | null = null;

  if (!hasDatabase) {
    // Mock mode: no database configured. Filter the seeded mock emails
    // in-memory so the inbox renders realistic content with working filters.
    const all = getMockEmails();
    unread = all.filter((e) => e.status === "UNREAD").length;
    const filtered = all.filter((e) => {
      if (status && e.status !== status) return false;
      if (priority && e.classification?.priority !== priority) return false;
      if (category && e.classification?.category !== category) return false;
      if (q) {
        const hay = [e.subject, e.snippet, e.fromName, e.fromAddr]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q.toLowerCase())) return false;
      }
      return true;
    });
    total = filtered.length;
    emails = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  } else {
    try {
      const [rows, count, unreadCount] = await Promise.all([
        prisma.email.findMany({
          where,
          orderBy: { receivedAt: "desc" },
          skip: (page - 1) * PAGE_SIZE,
          take: PAGE_SIZE,
          include: {
            classification: true,
            assignee: true,
            mailbox: true,
          },
        }),
        prisma.email.count({ where }),
        prisma.email.count({ where: { status: "UNREAD" } }),
      ]);
      total = count;
      unread = unreadCount;
      emails = rows as unknown as EmailWithClassification[];
    } catch (err) {
      loadError =
        err instanceof Error ? err.message : "Failed to load emails.";
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(q || priority || category || status);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-card)]">
      <InboxHeader unread={unread} />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        {/* LEFT: list pane (+ pagination footer) */}
        <div className="flex min-h-0 flex-1 flex-col lg:max-w-[360px] lg:flex-none">
          {loadError ? (
            <div className="flex-1 overflow-auto p-4">
              <ErrorState message={loadError} />
            </div>
          ) : emails.length === 0 ? (
            <div className="flex-1 overflow-auto p-4">
              <EmptyState hasFilters={hasFilters} />
            </div>
          ) : (
            <EmailList emails={emails} />
          )}

          {!loadError && total > PAGE_SIZE ? (
            <div className="shrink-0 border-t border-[var(--border)] px-4 py-3 lg:border-r">
              <InboxPagination
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={PAGE_SIZE}
              />
            </div>
          ) : null}
        </div>

        {/* CENTER/RIGHT: empty selection placeholder (desktop only) */}
        <div className="hidden flex-1 items-center justify-center bg-[var(--bg-subtle)] lg:flex">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-[var(--bg-card)] text-[var(--text-tertiary)] shadow-sm">
              <MailOpen className="size-6" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Select an email
              </p>
              <p className="text-sm text-[var(--text-secondary)]">
                Choose a message from the list to read it.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function InboxHeader({ unread }: { unread: number }) {
  return (
    <div className="flex shrink-0 flex-col gap-3 border-b border-[var(--border)] px-7 py-4 sm:flex-row sm:items-center">
      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-semibold tracking-tight text-[var(--text-primary)]">
            Inbox
          </h1>
          {unread > 0 ? (
            <span className="rounded-full bg-[var(--accent-subtle)] px-2 py-[3px] text-xs font-semibold text-[var(--accent)]">
              {unread.toLocaleString()} unread
            </span>
          ) : null}
        </div>
        <p className="text-[13px] text-[var(--text-secondary)]">
          AI-triaged and prioritized automatically
        </p>
      </div>
    </div>
  );
}

function EmptyState({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-[var(--border)] py-20 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-[var(--bg-subtle)] text-[var(--text-tertiary)]">
        <InboxIcon className="size-6" aria-hidden />
      </div>
      <div>
        <p className="font-medium text-[var(--text-primary)]">
          {hasFilters ? "No emails match your filters" : "Your inbox is empty"}
        </p>
        <p className="text-sm text-[var(--text-secondary)]">
          {hasFilters
            ? "Try clearing or adjusting your search."
            : "New messages will appear here once they're classified."}
        </p>
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-subtle)] py-20 text-center">
      <p className="font-medium text-[var(--danger)]">
        Couldn&apos;t load your inbox
      </p>
      <p className="max-w-md text-sm text-[var(--text-secondary)]">{message}</p>
    </div>
  );
}
