import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { prisma } from "@/lib/prisma";
import { hasDatabase } from "@/lib/env";
import { getMockEmailById, getMockEmails, MOCK_USERS } from "@/lib/mock-emails";
import type { EmailWithClassification, UserSummary } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmailList } from "@/components/inbox/email-list";
import { EmailDetail } from "@/components/inbox/email-detail";
import { InboxHeader } from "../page";

export const dynamic = "force-dynamic";

const LIST_SIZE = 15;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  if (!hasDatabase) {
    const mock = getMockEmailById(id);
    return {
      title: mock?.subject ? `${mock.subject} · Inbox AI` : "Email · Inbox AI",
    };
  }
  try {
    const email = await prisma.email.findUnique({
      where: { id },
      select: { subject: true },
    });
    return {
      title: email?.subject
        ? `${email.subject} · Inbox AI`
        : "Email · Inbox AI",
    };
  } catch {
    return { title: "Email · Inbox AI" };
  }
}

export default async function EmailDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let email: EmailWithClassification | null = null;
  let listEmails: EmailWithClassification[] = [];
  let unread = 0;
  let users: UserSummary[] = [];
  let loadError: string | null = null;

  if (!hasDatabase) {
    // Mock mode: resolve from seeded mock emails.
    email = getMockEmailById(id);
    if (!email) notFound();
    const all = getMockEmails();
    listEmails = all.slice(0, LIST_SIZE);
    unread = all.filter((e) => e.status === "UNREAD").length;
    users = MOCK_USERS;

    return (
      <InboxThreePane
        listEmails={listEmails}
        selected={email}
        users={users}
        unread={unread}
      />
    );
  }

  try {
    const [row, rows, unreadCount] = await Promise.all([
      prisma.email.findUnique({
        where: { id },
        include: {
          classification: true,
          assignee: true,
          mailbox: true,
        },
      }),
      prisma.email.findMany({
        orderBy: { receivedAt: "desc" },
        take: LIST_SIZE,
        include: {
          classification: true,
          assignee: true,
          mailbox: true,
        },
      }),
      prisma.email.count({ where: { status: "UNREAD" } }),
    ]);

    if (!row) notFound();
    email = row as unknown as EmailWithClassification;
    listEmails = rows as unknown as EmailWithClassification[];
    unread = unreadCount;

    // Assignable users scoped to the same organization as the mailbox.
    users = (await prisma.user.findMany({
      where: { org: { mailboxes: { some: { id: row.mailboxId } } } },
      select: { id: true, email: true, name: true, role: true },
      orderBy: { name: "asc" },
    })) as UserSummary[];
  } catch (err) {
    // notFound() throws a special digest we must not swallow.
    if (
      err &&
      typeof err === "object" &&
      "digest" in err &&
      String((err as { digest?: string }).digest).startsWith("NEXT_NOT_FOUND")
    ) {
      throw err;
    }
    loadError =
      err instanceof Error ? err.message : "Failed to load this email.";
  }

  if (loadError || !email) {
    return (
      <div className="flex h-full flex-col bg-[var(--bg-card)]">
        <InboxHeader unread={unread} />
        <div className="flex flex-1 items-center justify-center px-6">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-subtle)] px-8 py-12 text-center">
            <p className="font-medium text-[var(--danger)]">
              Couldn&apos;t load this email
            </p>
            <p className="max-w-sm text-sm text-[var(--text-secondary)]">
              {loadError ?? "The email is unavailable."}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              render={<Link href="/inbox" />}
            >
              Back to inbox
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <InboxThreePane
      listEmails={listEmails}
      selected={email}
      users={users}
      unread={unread}
    />
  );
}

function InboxThreePane({
  listEmails,
  selected,
  users,
  unread,
}: {
  listEmails: EmailWithClassification[];
  selected: EmailWithClassification;
  users: UserSummary[];
  unread: number;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-[var(--bg-card)]">
      <InboxHeader unread={unread} />

      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* LEFT list pane — desktop only; on mobile the detail takes over. */}
        <div className="hidden lg:flex">
          <EmailList emails={listEmails} selectedId={selected.id} />
        </div>

        {/* CENTER + RIGHT detail — full width on mobile. */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Mobile back-to-list bar */}
          <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border)] px-4 py-2.5 lg:hidden">
            <Button
              variant="ghost"
              size="sm"
              className="text-[var(--text-secondary)]"
              render={<Link href="/inbox" />}
            >
              <ArrowLeft className="size-4" aria-hidden />
              Inbox
            </Button>
          </div>

          <EmailDetail email={selected} users={users} />
        </div>
      </div>
    </div>
  );
}
