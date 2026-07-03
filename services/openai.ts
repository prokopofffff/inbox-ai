import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { env, hasOpenAI } from "@/lib/env";
import {
  classificationResultSchema,
  type ClassificationResult,
  type ClassifyEmailInput,
  type Category,
  type Priority,
  type Sentiment,
} from "@/lib/schemas";

/**
 * OpenAI integration for email classification.
 *
 * - `classifyEmail` uses the Responses API with structured JSON output,
 *   validated against `classificationResultSchema`. Retries once on invalid /
 *   unparseable output, then throws a typed `OpenAIClassificationError`.
 * - `streamSuggestedReply` streams a reply as an async generator of text
 *   deltas.
 * - When `OPENAI_API_KEY` is absent (or a placeholder), both functions fall
 *   back to a deterministic mock derived from the subject/body so the app runs
 *   locally without credentials. The mock is still valid against the schema.
 */

// ---------------------------------------------------------------------------
// Typed error
// ---------------------------------------------------------------------------

export class OpenAIClassificationError extends Error {
  readonly cause?: unknown;
  readonly rawOutput?: string;

  constructor(
    message: string,
    options?: { cause?: unknown; rawOutput?: string },
  ) {
    super(message);
    this.name = "OpenAIClassificationError";
    this.cause = options?.cause;
    this.rawOutput = options?.rawOutput;
  }
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    client = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  }
  return client;
}

const MODEL = env.OPENAI_MODEL;

// ---------------------------------------------------------------------------
// Prompt helpers
// ---------------------------------------------------------------------------

const SYSTEM_PROMPT = `You are an email triage assistant for a shared team inbox.
Classify each incoming email and produce a concise, professional draft reply.
Rules:
- category: one of SUPPORT, SALES, BILLING, SPAM, GENERAL, INTERNAL.
- priority: LOW, MEDIUM, HIGH, or URGENT based on urgency and business impact.
- sentiment: POSITIVE, NEUTRAL, or NEGATIVE for the sender's tone.
- confidence: your certainty from 0 to 1.
- summary: one or two sentences capturing the ask.
- suggestedReply: a ready-to-send, courteous reply. Do not invent facts.
- assignee: pick the single best name from the provided roster, or null if unsure or none provided.
Return only the structured object.`;

function buildUserMessage(input: ClassifyEmailInput): string {
  const from = [input.fromName, input.fromAddr].filter(Boolean).join(" ");
  const roster =
    input.knownAssignees && input.knownAssignees.length > 0
      ? input.knownAssignees.join(", ")
      : "(none provided)";
  const body = input.bodyText || input.snippet || "";
  return [
    `From: ${from || "(unknown)"}`,
    `Subject: ${input.subject || "(no subject)"}`,
    `Available assignees: ${roster}`,
    "",
    "Body:",
    body || "(empty body)",
  ].join("\n");
}

// ---------------------------------------------------------------------------
// classifyEmail
// ---------------------------------------------------------------------------

/**
 * Classify an email into structured JSON. Retries once on invalid output.
 * Falls back to a deterministic mock when no API key is configured.
 */
export async function classifyEmail(
  input: ClassifyEmailInput,
): Promise<ClassificationResult> {
  if (!hasOpenAI) {
    return mockClassify(input);
  }

  const openai = getClient();
  const userMessage = buildUserMessage(input);

  let lastRaw: string | undefined;
  let lastError: unknown;

  // Attempt, then one retry, on parse/validation failure.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await openai.responses.parse({
        model: MODEL,
        input: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content:
              attempt === 0
                ? userMessage
                : `${userMessage}\n\n(Your previous response was invalid. Respond with the exact required structured object.)`,
          },
        ],
        text: {
          format: zodTextFormat(
            classificationResultSchema,
            "email_classification",
          ),
        },
      });

      lastRaw = response.output_text;
      const parsed = response.output_parsed;

      if (parsed) {
        // `parse` already validated, but re-validate defensively so callers
        // always receive a value that satisfies the schema at runtime.
        return classificationResultSchema.parse(parsed);
      }

      // Fall back to manually validating the raw text.
      const manual = classificationResultSchema.safeParse(
        safeJsonParse(lastRaw),
      );
      if (manual.success) return manual.data;
      lastError = manual.error;
    } catch (error) {
      lastError = error;
      // Continue to retry on the first attempt.
    }
  }

  throw new OpenAIClassificationError(
    "Failed to obtain a valid classification from OpenAI after one retry.",
    { cause: lastError, rawOutput: lastRaw },
  );
}

// ---------------------------------------------------------------------------
// streamSuggestedReply
// ---------------------------------------------------------------------------

/**
 * Stream a suggested reply as an async generator of text chunks.
 * Yields incremental text deltas; callers can concatenate for the full reply.
 * Falls back to chunked mock text when no API key is configured.
 */
export async function* streamSuggestedReply(
  input: ClassifyEmailInput,
): AsyncGenerator<string, void, unknown> {
  if (!hasOpenAI) {
    yield* mockReplyStream(input);
    return;
  }

  const openai = getClient();
  const userMessage = buildUserMessage(input);

  const stream = await openai.responses.create({
    model: MODEL,
    stream: true,
    input: [
      {
        role: "system",
        content:
          "You are an email assistant. Write a concise, courteous, ready-to-send reply to the email below. Return only the reply body, no preamble.",
      },
      { role: "user", content: userMessage },
    ],
  });

  for await (const event of stream) {
    if (event.type === "response.output_text.delta" && event.delta) {
      yield event.delta;
    }
  }
}

// ---------------------------------------------------------------------------
// Deterministic mock (no API key)
// ---------------------------------------------------------------------------

function safeJsonParse(text: string | undefined): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

/** Simple, stable hash for deterministic mock selection. */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function includesAny(haystack: string, needles: string[]): boolean {
  return needles.some((n) => haystack.includes(n));
}

/**
 * Produce a deterministic classification from the email content so local dev
 * (and tests) get sensible, repeatable output without an API key.
 */
export function mockClassify(input: ClassifyEmailInput): ClassificationResult {
  const subject = input.subject ?? "";
  const body = input.bodyText || input.snippet || "";
  const from = `${input.fromName ?? ""} ${input.fromAddr ?? ""}`;
  const haystack = `${subject}\n${body}\n${from}`.toLowerCase();

  let category: Category = "GENERAL";
  if (
    includesAny(haystack, [
      "unsubscribe",
      "viagra",
      "lottery",
      "winner",
      "crypto",
      "free money",
    ])
  ) {
    category = "SPAM";
  } else if (
    includesAny(haystack, ["invoice", "payment", "billing", "refund", "charge"])
  ) {
    category = "BILLING";
  } else if (
    includesAny(haystack, ["demo", "pricing", "quote", "sales", "purchase", "buy"])
  ) {
    category = "SALES";
  } else if (
    includesAny(haystack, [
      "error",
      "bug",
      "not working",
      "issue",
      "help",
      "support",
      "broken",
    ])
  ) {
    category = "SUPPORT";
  } else if (
    input.fromAddr &&
    includesAny(input.fromAddr.toLowerCase(), ["internal", "team", "staff"])
  ) {
    category = "INTERNAL";
  }

  let priority: Priority = "MEDIUM";
  if (includesAny(haystack, ["urgent", "asap", "immediately", "critical", "down", "outage"])) {
    priority = "URGENT";
  } else if (includesAny(haystack, ["important", "priority", "soon", "deadline"])) {
    priority = "HIGH";
  } else if (category === "SPAM") {
    priority = "LOW";
  }

  let sentiment: Sentiment = "NEUTRAL";
  if (
    includesAny(haystack, [
      "angry",
      "frustrated",
      "unacceptable",
      "disappointed",
      "terrible",
      "worst",
      "refund",
    ])
  ) {
    sentiment = "NEGATIVE";
  } else if (
    includesAny(haystack, ["thank", "great", "love", "appreciate", "excellent", "awesome"])
  ) {
    sentiment = "POSITIVE";
  }

  // Deterministic confidence in [0.7, 0.98].
  const confidence =
    Math.round((0.7 + (hashString(haystack) % 29) / 100) * 100) / 100;

  const summary =
    subject.trim().length > 0
      ? `Email regarding "${subject.trim()}" categorized as ${category.toLowerCase()}.`
      : `A ${category.toLowerCase()} email with ${priority.toLowerCase()} priority.`;

  const assignee =
    input.knownAssignees && input.knownAssignees.length > 0
      ? input.knownAssignees[hashString(haystack) % input.knownAssignees.length]
      : null;

  const senderName = (input.fromName || input.fromAddr || "there").split(
    /[\s@]/,
  )[0];
  const suggestedReply =
    `Hi ${senderName || "there"},\n\n` +
    `Thanks for reaching out. We've received your message${
      subject.trim() ? ` about "${subject.trim()}"` : ""
    } and a member of our team will follow up shortly.\n\n` +
    `Best regards,\nThe Support Team`;

  return classificationResultSchema.parse({
    category,
    priority,
    summary,
    suggestedReply,
    sentiment,
    confidence,
    assignee,
  });
}

/** Yield the mock reply in word-sized chunks to emulate streaming. */
async function* mockReplyStream(
  input: ClassifyEmailInput,
): AsyncGenerator<string, void, unknown> {
  const { suggestedReply } = mockClassify(input);
  const tokens = suggestedReply.match(/\S+\s*/g) ?? [suggestedReply];
  for (const token of tokens) {
    yield token;
  }
}
