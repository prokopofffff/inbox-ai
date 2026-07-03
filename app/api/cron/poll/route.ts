import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { env, hasGoogle, hasOpenAI } from "@/lib/env";
import { classifyEmail } from "@/services/openai";
import {
  listNewMessages,
  getMessage,
  type GmailMailbox,
  type ParsedGmailMessage,
} from "@/services/gmail";
import { applyRules } from "./rule-engine";

// This route depends on request headers + DB state and must never be cached.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * GET /api/cron/poll
 *
 * Protected by CRON_SECRET, accepted via either:
 *   - Authorization: Bearer <secret>
 *   - x-cron-secret: <secret>
 *
 * For each Mailbox: fetch new Gmail messages, persist unseen emails,
 * classify via OpenAI, save the Classification, and apply matching
 * AutomationRules. Safe/no-op when external credentials are absent — the
 * gmail + openai services fall back to deterministic mock data.
 */
export async function GET(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;

  if (secret) {
    // Secret configured: always enforce it.
    if (!isAuthorized(request, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  } else if (process.env.NODE_ENV === "production") {
    // Fail closed in production: an unset secret must never leave this
    // Gmail/OpenAI-spending endpoint open to anonymous callers. Locally we
    // still allow it so the pipeline is runnable without env setup.
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }

  const summary = {
    processed: 0,
    classified: 0,
    rulesApplied: 0,
    mailboxes: 0,
    skipped: 0,
    gmailEnabled: hasGoogle,
    openaiEnabled: hasOpenAI,
  };

  let mailboxes: Awaited<ReturnType<typeof prisma.mailbox.findMany>>;
  try {
    mailboxes = await prisma.mailbox.findMany();
  } catch (err) {
    return NextResponse.json(
      { error: "Database unavailable", detail: errorMessage(err) },
      { status: 503 }
    );
  }

  summary.mailboxes = mailboxes.length;

  for (const mailbox of mailboxes) {
    const gmailMailbox: GmailMailbox = {
      id: mailbox.id,
      email: mailbox.email,
      accessToken: mailbox.accessToken,
      refreshToken: mailbox.refreshToken,
      historyId: mailbox.historyId,
    };

    let messageIds: string[] = [];

    try {
      const listed = await listNewMessages(
        gmailMailbox,
        mailbox.historyId ?? undefined
      );
      messageIds = listed.messageIds;

      // Persist the advanced historyId so subsequent polls are incremental.
      if (listed.historyId && listed.historyId !== mailbox.historyId) {
        await prisma.mailbox
          .update({
            where: { id: mailbox.id },
            data: { historyId: listed.historyId },
          })
          .catch(() => undefined);
      }
    } catch (err) {
      // A single mailbox failure should not abort the whole poll.
      console.error(`[cron/poll] list failed for ${mailbox.email}:`, err);
      continue;
    }

    for (const messageId of messageIds) {
      try {
        // Skip fetching/classifying messages we already stored (idempotent).
        const existing = await prisma.email.findUnique({
          where: { gmailId: messageId },
          select: { id: true },
        });
        if (existing) {
          summary.skipped += 1;
          continue;
        }

        const message = await getMessage(gmailMailbox, messageId);

        const processed = await processMessage(
          mailbox.id,
          mailbox.orgId,
          message
        );
        if (processed.skipped) {
          summary.skipped += 1;
          continue;
        }
        summary.processed += 1;
        if (processed.classified) summary.classified += 1;
        summary.rulesApplied += processed.rulesApplied;
      } catch (err) {
        console.error(
          `[cron/poll] failed to process message ${messageId}:`,
          err
        );
      }
    }
  }

  return NextResponse.json(summary);
}

function isAuthorized(request: Request, secret: string): boolean {
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const [scheme, token] = authHeader.split(" ");
    if (scheme?.toLowerCase() === "bearer" && token === secret) return true;
  }
  const custom = request.headers.get("x-cron-secret");
  if (custom && custom === secret) return true;
  return false;
}

type ProcessResult = {
  skipped: boolean;
  classified: boolean;
  rulesApplied: number;
};

async function processMessage(
  mailboxId: string,
  orgId: string,
  message: ParsedGmailMessage
): Promise<ProcessResult> {
  // Double-check idempotency (guards against races between list + store).
  const existing = await prisma.email.findUnique({
    where: { gmailId: message.gmailId },
    select: { id: true },
  });
  if (existing) {
    return { skipped: true, classified: false, rulesApplied: 0 };
  }

  const email = await prisma.email.create({
    data: {
      gmailId: message.gmailId,
      threadId: message.threadId ?? null,
      fromAddr: message.fromAddr,
      fromName: message.fromName ?? null,
      toAddr: message.toAddr ?? null,
      subject: message.subject ?? null,
      snippet: message.snippet ?? null,
      bodyText: message.bodyText ?? null,
      bodyHtml: message.bodyHtml ?? null,
      receivedAt: message.receivedAt ?? new Date(),
      status: "UNREAD",
      mailboxId,
      raw: (message.raw ?? undefined) as never,
    },
  });

  let classified = false;

  try {
    // classifyEmail falls back to a deterministic mock without an API key,
    // so we still get a Classification row locally.
    const result = await classifyEmail({
      fromAddr: email.fromAddr,
      fromName: email.fromName ?? undefined,
      subject: email.subject ?? undefined,
      bodyText: email.bodyText ?? email.snippet ?? undefined,
    });

    await prisma.classification.create({
      data: {
        emailId: email.id,
        category: result.category,
        priority: result.priority,
        summary: result.summary,
        suggestedReply: result.suggestedReply,
        sentiment: result.sentiment,
        confidence: result.confidence,
        assignee: result.assignee ?? null,
        model: hasOpenAI ? env.OPENAI_MODEL : null,
      },
    });
    classified = true;
  } catch (err) {
    console.error(
      `[cron/poll] classification failed for ${email.gmailId}:`,
      err
    );
  }

  const rulesApplied = await applyRules(orgId, email);

  return { skipped: false, classified, rulesApplied };
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
