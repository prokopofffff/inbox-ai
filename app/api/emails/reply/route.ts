import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { hasDatabase } from "@/lib/env";
import { getCurrentUser } from "@/lib/auth";
import { getMockEmailById } from "@/lib/mock-emails";
import { streamSuggestedReply } from "@/services/openai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReplyBody = {
  emailId?: string;
  instruction?: string;
};

/**
 * POST /api/emails/reply
 *
 * Streams an AI-generated suggested reply for a given email as a
 * text/plain stream. Falls back to a static mock stream when OpenAI
 * is not configured so the UI still functions locally.
 *
 * Body: { emailId: string, instruction?: string }
 */
export async function POST(request: Request): Promise<Response> {
  // This endpoint streams an email's contents back and spends OpenAI tokens,
  // and the middleware matcher excludes /api — so it must gate itself.
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: ReplyBody;
  try {
    body = (await request.json()) as ReplyBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const emailId = body.emailId;
  if (!emailId) {
    return NextResponse.json({ error: "emailId is required" }, { status: 400 });
  }

  let email: {
    fromAddr: string;
    fromName: string | null;
    subject: string | null;
    bodyText: string | null;
    snippet: string | null;
  } | null;

  if (!hasDatabase) {
    // Mock mode: resolve from the seeded mock inbox so the reply UI works.
    const mock = getMockEmailById(emailId);
    email = mock
      ? {
          fromAddr: mock.fromAddr,
          fromName: mock.fromName,
          subject: mock.subject,
          bodyText: mock.bodyText,
          snippet: mock.snippet,
        }
      : null;
  } else {
    try {
      // Scope to the caller's org (an Email belongs to an org via its Mailbox)
      // so a caller cannot stream back another tenant's email.
      email = await prisma.email.findFirst({
        where: { id: emailId, mailbox: { orgId: user.orgId } },
        select: {
          fromAddr: true,
          fromName: true,
          subject: true,
          bodyText: true,
          snippet: true,
        },
      });
    } catch (err) {
      return NextResponse.json(
        { error: "Database unavailable", detail: errorMessage(err) },
        { status: 503 }
      );
    }
  }

  if (!email) {
    return NextResponse.json({ error: "Email not found" }, { status: 404 });
  }

  const encoder = new TextEncoder();

  // streamSuggestedReply already degrades to a mock stream when OpenAI is
  // unavailable, so we can call it unconditionally.
  try {
    const source = streamSuggestedReply({
      fromAddr: email.fromAddr,
      fromName: email.fromName ?? undefined,
      subject: email.subject ?? undefined,
      // Fold any caller instruction into the body context.
      bodyText: [email.bodyText ?? email.snippet ?? "", body.instruction]
        .filter(Boolean)
        .join("\n\n"),
    });

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of source) {
            if (chunk) controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(`\n[stream error] ${errorMessage(err)}`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return streamResponse(stream);
  } catch (err) {
    return NextResponse.json(
      { error: "Failed to start stream", detail: errorMessage(err) },
      { status: 500 }
    );
  }
}

function streamResponse(stream: ReadableStream<Uint8Array>): Response {
  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
