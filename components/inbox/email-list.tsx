"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import type { EmailWithClassification } from "@/lib/types";
import { timeAgo } from "./utils";

const PRIORITY_DOT: Record<string, string> = {
  URGENT: "bg-[var(--danger)]",
  HIGH: "bg-[var(--danger)]",
  MEDIUM: "bg-[var(--warning)]",
  LOW: "bg-[var(--text-tertiary)]",
};
const PRIORITY_TEXT: Record<string, string> = {
  URGENT: "text-[var(--danger)]",
  HIGH: "text-[var(--danger)]",
  MEDIUM: "text-[var(--warning)]",
  LOW: "text-[var(--text-secondary)]",
};
const CATEGORY_COLOR: Record<string, string> = {
  SUPPORT: "var(--accent)",
  SALES: "var(--purple)",
  BILLING: "var(--warning)",
  SPAM: "var(--text-tertiary)",
  GENERAL: "var(--success)",
  INTERNAL: "var(--purple)",
};
type Tab = "ALL" | "UNREAD" | "ASSIGNED";

/**
 * Left inbox pane: tabs + compact search + selectable email rows.
 *
 * Presentation only — filtering/pagination stays URL-driven via the parent
 * server component. Tabs are a thin client-side view filter over the rows the
 * server already returned (All / Unread / Assigned), and search debounces into
 * the `q` query param.
 */
export function EmailList({
  emails,
  selectedId,
}: {
  emails: EmailWithClassification[];
  selectedId?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = React.useState<Tab>("ALL");

  const urlQuery = searchParams.get("q") ?? "";
  const [search, setSearch] = React.useState(urlQuery);
  const [lastUrlQuery, setLastUrlQuery] = React.useState(urlQuery);
  if (urlQuery !== lastUrlQuery) {
    setLastUrlQuery(urlQuery);
    setSearch(urlQuery);
  }

  React.useEffect(() => {
    if (search === urlQuery) return;
    const t = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const next = search.trim();
      if (next) params.set("q", next);
      else params.delete("q");
      params.delete("page");
      const qs = params.toString();
      router.replace(qs ? `/inbox?${qs}` : "/inbox", { scroll: false });
    }, 350);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const visible = emails.filter((e) => {
    if (tab === "UNREAD") return e.status === "UNREAD";
    if (tab === "ASSIGNED") return Boolean(e.assigneeId || e.assignee);
    return true;
  });

  // Preserve current query params when navigating between rows.
  const rowHref = React.useCallback(
    (id: string) => {
      const qs = searchParams.toString();
      return qs ? `/inbox/${id}?${qs}` : `/inbox/${id}`;
    },
    [searchParams]
  );

  return (
    <div className="flex h-full min-h-0 w-full flex-col bg-[var(--bg-card)] lg:w-[360px] lg:shrink-0 lg:border-r lg:border-[var(--border)]">
      {/* Tabs */}
      <div className="flex shrink-0 items-center gap-1.5 border-b border-[var(--border)] px-4 py-2.5">
        {(["ALL", "UNREAD", "ASSIGNED"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-[13px] transition-colors",
              tab === t
                ? "bg-[var(--bg-hover)] font-semibold text-[var(--text-primary)]"
                : "font-medium text-[var(--text-secondary)] hover:bg-[var(--bg-subtle)]"
            )}
          >
            {t === "ALL" ? "All" : t === "UNREAD" ? "Unread" : "Assigned"}
          </button>
        ))}
      </div>

      {/* Compact search */}
      <div className="shrink-0 border-b border-[var(--border)] px-4 py-2.5">
        <div className="relative">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-[var(--text-tertiary)]"
            aria-hidden
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search emails"
            aria-label="Search emails"
            className="h-9 w-full rounded-lg border border-[var(--border)] bg-[var(--bg-subtle)] pr-3 pl-9 text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus-visible:border-[var(--accent)] focus-visible:ring-2 focus-visible:ring-[var(--accent-subtle)] focus-visible:outline-none"
          />
        </div>
      </div>

      {/* Rows */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-[var(--text-secondary)]">
            {tab === "ALL"
              ? "No emails to show."
              : tab === "UNREAD"
                ? "No unread emails."
                : "No assigned emails."}
          </p>
        ) : (
          <ul>
            {visible.map((email) => (
              <EmailRow
                key={email.id}
                email={email}
                href={rowHref(email.id)}
                selected={email.id === selectedId}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Chip({
  label,
  color,
}: {
  label: string;
  color: string;
}) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium leading-none"
      style={{ backgroundColor: "var(--accent-subtle)", color }}
    >
      <span
        aria-hidden
        className="size-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      {label}
    </span>
  );
}

function EmailRow({
  email,
  href,
  selected,
}: {
  email: EmailWithClassification;
  href: string;
  selected: boolean;
}) {
  const classification = email.classification;
  const senderName = email.fromName || email.fromAddr;
  const isUnread = email.status === "UNREAD";
  const priority = classification?.priority;

  return (
    <li>
      <Link
        href={href}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex flex-col gap-2 border-b border-[var(--border)] py-3.5 pr-4 pl-5 transition-colors",
          selected
            ? "border-l-[3px] border-l-[var(--accent)] bg-[var(--accent-subtle)] pl-[17px]"
            : "hover:bg-[var(--bg-subtle)]"
        )}
      >
        <div className="flex items-center gap-2">
          {isUnread ? (
            <span
              aria-hidden
              className="size-[7px] shrink-0 rounded-full bg-[var(--accent)]"
            />
          ) : null}
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-[var(--text-primary)]">
            {senderName}
          </span>
          <span className="shrink-0 text-xs text-[var(--text-tertiary)]">
            {timeAgo(email.receivedAt)}
          </span>
        </div>

        <p className="truncate text-[13px] font-medium text-[var(--text-secondary)]">
          {email.subject || "(no subject)"}
        </p>
        {email.snippet ? (
          <p className="truncate text-xs text-[var(--text-tertiary)]">
            {email.snippet}
          </p>
        ) : null}

        {classification ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <Chip
              label={CATEGORY_LABEL[classification.category] ?? classification.category}
              color={CATEGORY_COLOR[classification.category] ?? "var(--accent)"}
            />
            {priority ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[12px] font-medium leading-none",
                  PRIORITY_TEXT[priority]
                )}
                style={{ backgroundColor: "var(--accent-subtle)" }}
              >
                <span
                  aria-hidden
                  className={cn("size-1.5 shrink-0 rounded-full", PRIORITY_DOT[priority])}
                />
                {PRIORITY_LABEL[priority] ?? priority}
              </span>
            ) : null}
          </div>
        ) : (
          <span className="text-xs text-[var(--text-tertiary)]">Not yet classified</span>
        )}
      </Link>
    </li>
  );
}
