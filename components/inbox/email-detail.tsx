"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles,
  RefreshCw,
  Reply,
  Archive,
  UserPlus,
  Check,
  Loader2,
  Send,
  Mail,
  WandSparkles,
  CircleCheckBig,
  Smile,
  Meh,
  Frown,
  Star,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { assignEmail, archiveEmail, sendReply } from "@/actions/emails";
import { CATEGORY_LABEL, PRIORITY_LABEL } from "@/lib/labels";
import type {
  EmailWithClassification,
  Priority,
  Sentiment,
  UserSummary,
} from "@/lib/types";
import { formatFullDate, initials } from "./utils";

const PRIORITY_COLOR: Record<Priority, string> = {
  URGENT: "var(--danger)",
  HIGH: "var(--danger)",
  MEDIUM: "var(--warning)",
  LOW: "var(--text-secondary)",
};

const SENTIMENT_META: Record<
  Sentiment,
  {
    label: string;
    caption: string;
    color: string;
    subtle: string;
    Icon: typeof Smile;
  }
> = {
  POSITIVE: {
    label: "Positive",
    caption: "Positive tone detected",
    color: "var(--success)",
    subtle: "var(--success-subtle)",
    Icon: Smile,
  },
  NEUTRAL: {
    label: "Neutral",
    caption: "Neutral tone detected",
    color: "var(--text-secondary)",
    subtle: "var(--bg-subtle)",
    Icon: Meh,
  },
  NEGATIVE: {
    label: "Frustrated",
    caption: "Negative tone detected",
    color: "var(--danger)",
    subtle: "var(--danger-subtle)",
    Icon: Frown,
  },
};

/** Derive a display company from an email domain (best-effort, mock-friendly). */
function companyFromEmail(addr: string): string {
  const domain = addr.split("@")[1] ?? "";
  const name = domain.split(".")[0] ?? "";
  if (!name) return "Unknown company";
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function EmailDetail({
  email,
  users,
}: {
  email: EmailWithClassification;
  users: UserSummary[];
}) {
  const router = useRouter();
  const classification = email.classification;

  const [reply, setReply] = React.useState(classification?.suggestedReply ?? "");
  const [streaming, setStreaming] = React.useState(false);
  const [assignee, setAssignee] = React.useState<UserSummary | null>(
    email.assignee
  );
  const [replyOpen, setReplyOpen] = React.useState(false);
  const abortRef = React.useRef<AbortController | null>(null);

  React.useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  // ---- Streaming regenerate --------------------------------------------
  async function handleRegenerate() {
    if (streaming) return;
    setStreaming(true);
    setReply("");
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/emails/reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emailId: email.id }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        throw new Error(`Request failed (${res.status})`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      let done = false;
      while (!done) {
        const chunk = await reader.read();
        done = chunk.done;
        if (chunk.value) {
          acc += decoder.decode(chunk.value, { stream: true });
          setReply(acc);
        }
      }
      toast.success("Suggested reply regenerated");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return;
      toast.error(
        err instanceof Error ? err.message : "Failed to regenerate reply"
      );
      // Restore the previous suggestion on failure.
      setReply(classification?.suggestedReply ?? "");
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  // ---- Assign ----------------------------------------------------------
  const assignMutation = useMutation({
    mutationFn: async (userId: string | null) => {
      const res = await assignEmail(email.id, userId);
      if (!res.ok) throw new Error(res.error);
      return userId;
    },
    onMutate: (userId) => {
      const previous = assignee;
      setAssignee(userId ? users.find((u) => u.id === userId) ?? null : null);
      return { previous };
    },
    onSuccess: () => {
      toast.success("Assignee updated");
      router.refresh();
    },
    onError: (err, _userId, ctx) => {
      setAssignee(ctx?.previous ?? null);
      toast.error(err instanceof Error ? err.message : "Failed to assign");
    },
  });

  // ---- Archive ---------------------------------------------------------
  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await archiveEmail(email.id);
      if (!res.ok) throw new Error(res.error);
    },
    onSuccess: () => {
      toast.success("Email archived");
      router.push("/inbox");
      router.refresh();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to archive");
    },
  });

  // ---- Send reply ------------------------------------------------------
  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await sendReply(email.id, reply);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onSuccess: (data) => {
      setReplyOpen(false);
      toast.success(
        data?.mocked
          ? "Reply sent (mock — no Gmail credentials configured)"
          : "Reply sent"
      );
      router.refresh();
    },
    onError: (err) => {
      toast.error(err instanceof Error ? err.message : "Failed to send reply");
    },
  });

  const senderName = email.fromName || email.fromAddr;
  const isArchived = email.status === "ARCHIVED";
  const company = companyFromEmail(email.fromAddr);
  const confidence = classification
    ? Math.round(classification.confidence * 100)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden xl:flex-row">
        {/* ---- CENTER: message + AI summary + suggested reply ---- */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          {/* Subject + meta */}
          <div className="flex shrink-0 items-start gap-3 border-b border-[var(--border)] px-7 py-4">
            <div className="min-w-0 flex-1 space-y-2">
              <h1 className="text-lg font-semibold tracking-tight text-balance text-[var(--text-primary)]">
                {email.subject || "(no subject)"}
              </h1>
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[var(--purple-subtle)] text-[11px] font-semibold text-[var(--purple)]">
                  {initials(email.fromName, email.fromAddr)}
                </span>
                <span className="text-[13px] font-semibold text-[var(--text-primary)]">
                  {senderName}
                </span>
                <span className="text-[13px] text-[var(--text-secondary)]">
                  {email.fromAddr} · {formatFullDate(email.receivedAt)}
                </span>
              </div>
            </div>
            <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
              <IconBtn label="Star">
                <Star className="size-4 text-[var(--text-secondary)]" aria-hidden />
              </IconBtn>
              <IconBtn
                label="Archive"
                onClick={() => archiveMutation.mutate()}
                disabled={archiveMutation.isPending || isArchived}
              >
                {archiveMutation.isPending ? (
                  <Loader2 className="size-4 animate-spin text-[var(--text-secondary)]" aria-hidden />
                ) : (
                  <Archive className="size-4 text-[var(--text-secondary)]" aria-hidden />
                )}
              </IconBtn>
            </div>
          </div>

          {/* Scrollable body */}
          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-7 py-6">
            {/* Original message */}
            <section className="space-y-3">
              <SectionLabel color="var(--text-secondary)">
                <Mail className="size-[15px]" aria-hidden />
                ORIGINAL MESSAGE
              </SectionLabel>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <OriginalBody email={email} />
              </div>
            </section>

            {/* AI Summary */}
            {classification ? (
              <section className="rounded-xl border border-[var(--accent)]/15 bg-[var(--accent-subtle)] p-[18px]">
                <SectionLabel color="var(--accent)">
                  <Sparkles className="size-[15px]" aria-hidden />
                  AI SUMMARY
                </SectionLabel>
                <p className="mt-2.5 text-sm leading-[22px] text-[var(--text-primary)]">
                  {classification.summary}
                </p>
              </section>
            ) : null}

            {/* Suggested reply */}
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <SectionLabel color="var(--purple)">
                  <WandSparkles className="size-[15px]" aria-hidden />
                  SUGGESTED REPLY
                </SectionLabel>
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={streaming}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2.5 py-[5px] text-[12px] font-medium text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-60"
                >
                  <RefreshCw
                    className={cn("size-[13px]", streaming && "animate-spin")}
                    aria-hidden
                  />
                  {streaming ? "Generating…" : "Regenerate"}
                </button>
              </div>
              <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
                <Textarea
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder="The AI suggested reply will appear here…"
                  rows={7}
                  className="resize-y border-0 bg-transparent p-0 text-sm leading-[22px] text-[var(--text-primary)] shadow-none focus-visible:ring-0"
                  aria-label="Suggested reply"
                />
                <div className="flex items-center gap-2.5 border-t border-[var(--border)] pt-3.5">
                  <Button
                    onClick={() => setReplyOpen(true)}
                    disabled={!reply.trim() || streaming}
                  >
                    <Check className="size-4" aria-hidden />
                    Use this reply
                  </Button>
                </div>
              </div>
            </section>
          </div>

          {/* Bottom action bar */}
          <div className="flex shrink-0 flex-wrap items-center gap-2.5 border-t border-[var(--border)] bg-[var(--bg-card)] px-7 py-3.5">
            <Button onClick={() => setReplyOpen(true)}>
              <Reply className="size-4" aria-hidden />
              Reply
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="outline" disabled={assignMutation.isPending} />
                }
              >
                <UserPlus className="size-4" aria-hidden />
                {assignee ? assignee.name || assignee.email : "Assign"}
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56">
                <DropdownMenuLabel>Assign to</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {users.length === 0 ? (
                  <DropdownMenuItem disabled>No teammates found</DropdownMenuItem>
                ) : (
                  users.map((u) => (
                    <DropdownMenuItem
                      key={u.id}
                      onSelect={() => assignMutation.mutate(u.id)}
                    >
                      <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--bg-hover)] text-[10px] font-medium">
                        {initials(u.name, u.email)}
                      </span>
                      <span className="truncate">{u.name || u.email}</span>
                      {assignee?.id === u.id ? (
                        <Check className="ml-auto size-4" aria-hidden />
                      ) : null}
                    </DropdownMenuItem>
                  ))
                )}
                {assignee ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => assignMutation.mutate(null)}>
                      Unassign
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="outline" disabled title="Create a follow-up task">
              <CircleCheckBig className="size-4" aria-hidden />
              Create Task
            </Button>

            <Button
              variant="outline"
              onClick={() => archiveMutation.mutate()}
              disabled={archiveMutation.isPending || isArchived}
            >
              {archiveMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Archive className="size-4" aria-hidden />
              )}
              {isArchived ? "Archived" : "Archive"}
            </Button>
          </div>
        </div>

        {/* ---- RIGHT: meta rail ---- */}
        <aside className="shrink-0 space-y-[18px] overflow-y-auto border-t border-[var(--border)] bg-[var(--bg-subtle)] p-6 xl:w-[300px] xl:border-t-0 xl:border-l">
          {/* Detected customer */}
          <div className="space-y-3.5 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
            <RailLabel>DETECTED CUSTOMER</RailLabel>
            <div className="flex items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--purple-subtle)] text-sm font-semibold text-[var(--purple)]">
                {initials(email.fromName, email.fromAddr)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-[var(--text-primary)]">
                  {senderName}
                </p>
                <p className="truncate text-xs text-[var(--text-secondary)]">
                  {company}
                </p>
              </div>
            </div>
            <div className="h-px w-full bg-[var(--border)]" />
            <dl className="space-y-2.5">
              <RailRow k="Email">
                <span className="truncate text-[13px] font-medium text-[var(--text-primary)]">
                  {email.fromAddr}
                </span>
              </RailRow>
              {email.mailbox ? (
                <RailRow k="Account">
                  <span className="truncate text-[13px] font-semibold text-[var(--text-primary)]">
                    {email.mailbox.email}
                  </span>
                </RailRow>
              ) : null}
              {classification ? (
                <RailRow k="Priority">
                  <span
                    className="text-[13px] font-semibold"
                    style={{ color: PRIORITY_COLOR[classification.priority] }}
                  >
                    {PRIORITY_LABEL[classification.priority]}
                  </span>
                </RailRow>
              ) : null}
            </dl>
          </div>

          {classification ? (
            <>
              {/* Sentiment */}
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <RailLabel>SENTIMENT</RailLabel>
                {(() => {
                  const meta = SENTIMENT_META[classification.sentiment];
                  const { Icon } = meta;
                  return (
                    <div className="flex items-center gap-3">
                      <span
                        className="flex size-[38px] shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: meta.subtle }}
                      >
                        <Icon
                          className="size-5"
                          style={{ color: meta.color }}
                          aria-hidden
                        />
                      </span>
                      <div className="min-w-0">
                        <p
                          className="text-[15px] font-semibold"
                          style={{ color: meta.color }}
                        >
                          {meta.label}
                        </p>
                        <p className="text-xs text-[var(--text-secondary)]">
                          {meta.caption}
                        </p>
                      </div>
                    </div>
                  );
                })()}
              </div>

              {/* AI confidence */}
              <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                <RailLabel>AI CONFIDENCE</RailLabel>
                <div className="flex items-end justify-between">
                  <span className="text-[28px] font-bold tracking-tight text-[var(--text-primary)] tabular-nums">
                    {confidence}%
                  </span>
                  <span
                    className="text-xs font-medium"
                    style={{
                      color:
                        (confidence ?? 0) >= 80
                          ? "var(--success)"
                          : (confidence ?? 0) >= 50
                            ? "var(--warning)"
                            : "var(--danger)",
                    }}
                  >
                    {(confidence ?? 0) >= 80
                      ? "High confidence"
                      : (confidence ?? 0) >= 50
                        ? "Medium confidence"
                        : "Low confidence"}
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--bg-hover)]">
                  <div
                    className="h-2 rounded-full bg-[var(--accent)]"
                    style={{ width: `${confidence ?? 0}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Category:{" "}
                  {CATEGORY_LABEL[classification.category] ??
                    classification.category}{" "}
                  · Priority: {PRIORITY_LABEL[classification.priority]}
                </p>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
              <p className="text-sm text-[var(--text-secondary)]">
                This email hasn&apos;t been classified yet.
              </p>
            </div>
          )}
        </aside>
      </div>

      {/* Reply dialog */}
      <Dialog open={replyOpen} onOpenChange={setReplyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Reply to {senderName}</DialogTitle>
            <DialogDescription className="truncate">
              Re: {email.subject || "(no subject)"}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={10}
            className="resize-y"
            aria-label="Reply body"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReplyOpen(false)}
              disabled={sendMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={sendMutation.isPending || !reply.trim()}
            >
              {sendMutation.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
              ) : (
                <Send className="size-4" aria-hidden />
              )}
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function IconBtn({
  label,
  children,
  onClick,
  disabled,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-[34px] items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--bg-card)] transition-colors hover:bg-[var(--bg-subtle)] disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function SectionLabel({
  color,
  children,
}: {
  color: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex w-fit items-center gap-1.5 text-[12px] font-semibold tracking-[0.3px]"
      style={{ color }}
    >
      {children}
    </div>
  );
}

function RailLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold tracking-[0.4px] text-[var(--text-tertiary)]">
      {children}
    </p>
  );
}

function RailRow({
  k,
  children,
}: {
  k: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="shrink-0 text-[13px] text-[var(--text-secondary)]">{k}</dt>
      <dd className="min-w-0 text-right">{children}</dd>
    </div>
  );
}

/**
 * Renders the original email body. Prefers sanitized HTML; falls back to
 * whitespace-preserved plain text. HTML is minimally sanitized (script/style/
 * event-handler/`javascript:` stripping) since no DOMPurify dep is available.
 */
function OriginalBody({ email }: { email: EmailWithClassification }) {
  const html = email.bodyHtml ? sanitizeHtml(email.bodyHtml) : null;

  if (html) {
    return (
      <div
        className="prose prose-sm max-w-none text-sm leading-relaxed break-words text-[var(--text-primary)] dark:prose-invert [&_a]:text-[var(--accent)] [&_a]:underline"
        // Sanitized above; safe to render.
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }

  if (email.bodyText) {
    return (
      <div className="text-sm leading-[22px] break-words whitespace-pre-wrap text-[var(--text-primary)]">
        {email.bodyText}
      </div>
    );
  }

  return (
    <p className="text-sm text-[var(--text-secondary)] italic">
      {email.snippet || "This email has no content."}
    </p>
  );
}

/**
 * Best-effort HTML sanitizer for untrusted email bodies. Strips script/style
 * blocks, inline event handlers, and `javascript:`/`data:` URLs. This is a
 * defensive fallback; a real deployment should route through DOMPurify.
 */
function sanitizeHtml(input: string): string {
  return input
    .replace(/<\s*(script|style|iframe|object|embed|link|meta)[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|iframe|object|embed|link|meta)[^>]*\/?>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi, '$1="#"')
    .replace(/(href|src)\s*=\s*("|')\s*data:[^"']*\2/gi, '$1="#"');
}
