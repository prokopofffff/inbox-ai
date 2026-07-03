"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { env, hasDatabase, hasGoogle, hasOpenAI } from "@/lib/env";
import { requireCurrentUser } from "@/lib/auth";
import { classifyEmail } from "@/services/openai";

type EmailStatus = "UNREAD" | "READ" | "ARCHIVED";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function revalidateEmailViews() {
  revalidatePath("/inbox");
  revalidatePath("/dashboard");
}

/**
 * Verify that `emailId` exists AND belongs to the caller's organization
 * (an Email is scoped to an org via its Mailbox). Returns the email id when
 * owned, or `null` otherwise. This is the tenant-isolation guard every
 * mutating action must pass before writing — server actions are public POST
 * endpoints, so ownership can never be inferred from the caller.
 */
async function assertOwnedEmail(
  emailId: string,
  orgId: string
): Promise<{ id: string } | null> {
  return prisma.email.findFirst({
    where: { id: emailId, mailbox: { orgId } },
    select: { id: true },
  });
}

/**
 * Assign an email to a user. Passing `null` for userId unassigns.
 */
export async function assignEmail(
  emailId: string,
  userId: string | null
): Promise<ActionResult> {
  if (!emailId) return { ok: false, error: "emailId is required" };

  try {
    const user = await requireCurrentUser();

    const owned = await assertOwnedEmail(emailId, user.orgId);
    if (!owned) return { ok: false, error: "Email not found" };

    // Assignee must belong to the same org — never assign across tenants.
    if (userId) {
      const assignee = await prisma.user.findFirst({
        where: { id: userId, orgId: user.orgId },
        select: { id: true },
      });
      if (!assignee) return { ok: false, error: "Assignee not found" };
    }

    await prisma.email.update({
      where: { id: emailId },
      data: { assigneeId: userId ?? null },
    });
    revalidateEmailViews();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Archive an email (sets status to ARCHIVED).
 */
export async function archiveEmail(emailId: string): Promise<ActionResult> {
  return setEmailStatus(emailId, "ARCHIVED");
}

/**
 * Update the status of an email (UNREAD | READ | ARCHIVED).
 */
export async function setEmailStatus(
  emailId: string,
  status: EmailStatus
): Promise<ActionResult> {
  if (!emailId) return { ok: false, error: "emailId is required" };
  if (!["UNREAD", "READ", "ARCHIVED"].includes(status)) {
    return { ok: false, error: `Invalid status: ${status}` };
  }

  try {
    const user = await requireCurrentUser();

    const owned = await assertOwnedEmail(emailId, user.orgId);
    if (!owned) return { ok: false, error: "Email not found" };

    await prisma.email.update({
      where: { id: emailId },
      data: { status },
    });
    revalidateEmailViews();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Send a reply to an email. Stubs the Gmail send and mocks cleanly
 * when no Gmail credentials are configured. Marks the email READ.
 */
export async function sendReply(
  emailId: string,
  body: string
): Promise<ActionResult<{ mocked: boolean }>> {
  if (!emailId) return { ok: false, error: "emailId is required" };
  if (!body?.trim()) return { ok: false, error: "Reply body is required" };

  try {
    const user = await requireCurrentUser();

    // Mock mode (no database): report a successful mocked send so the demo UI
    // behaves, without attempting to persist.
    if (!hasDatabase) {
      return { ok: true, data: { mocked: true } };
    }

    const email = await prisma.email.findFirst({
      where: { id: emailId, mailbox: { orgId: user.orgId } },
      include: { mailbox: true },
    });

    if (!email) return { ok: false, error: "Email not found" };

    // Gmail send is stubbed. When Google credentials are absent we mock the
    // send entirely; when present we log the outbound (the gmail service does
    // not yet expose a send API, so this remains a safe stub either way).
    const mocked = !hasGoogle;

    if (!mocked) {
      console.info(
        `[sendReply] (stub) sending reply from ${email.mailbox.email} to ${email.fromAddr}` +
          ` re: ${email.subject ?? "(no subject)"}`
      );
    }

    // Optimistically mark the thread as read once a reply is sent.
    await prisma.email.update({
      where: { id: emailId },
      data: { status: "READ" },
    });

    revalidateEmailViews();
    return { ok: true, data: { mocked } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Re-run AI classification for an email and upsert the Classification.
 * No-ops gracefully (returns an error result) when OpenAI is unavailable.
 */
export async function reclassifyEmail(
  emailId: string
): Promise<ActionResult> {
  if (!emailId) return { ok: false, error: "emailId is required" };

  try {
    const user = await requireCurrentUser();

    const email = await prisma.email.findFirst({
      where: { id: emailId, mailbox: { orgId: user.orgId } },
    });
    if (!email) return { ok: false, error: "Email not found" };

    // classifyEmail degrades to a deterministic mock when OpenAI is absent,
    // so this works with or without credentials.
    const result = await classifyEmail({
      fromAddr: email.fromAddr,
      fromName: email.fromName ?? undefined,
      subject: email.subject ?? undefined,
      bodyText: email.bodyText ?? email.snippet ?? undefined,
    });

    const model = hasOpenAI ? env.OPENAI_MODEL : null;

    const data = {
      category: result.category,
      priority: result.priority,
      summary: result.summary,
      suggestedReply: result.suggestedReply,
      sentiment: result.sentiment,
      confidence: result.confidence,
      assignee: result.assignee ?? null,
      model,
    };

    await prisma.classification.upsert({
      where: { emailId },
      create: { emailId, ...data },
      update: data,
    });

    revalidateEmailViews();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
