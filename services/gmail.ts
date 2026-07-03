import { google, type gmail_v1 } from "googleapis";

import { env, hasGoogle } from "@/lib/env";

/**
 * Use the OAuth2 client type as produced by `google.auth.OAuth2` so it stays
 * compatible with the (possibly nested) `google-auth-library` copy that
 * `googleapis` resolves internally.
 */
type OAuth2Client = InstanceType<typeof google.auth.OAuth2>;

/**
 * Gmail integration.
 *
 * - `createOAuthClient` builds a configured OAuth2 client (optionally seeded
 *   with a mailbox's tokens).
 * - `listNewMessages` returns message ids that arrived since `historyId`
 *   (or the most recent messages when no history cursor is available), along
 *   with the latest `historyId` to persist for the next poll.
 * - `getMessage` fetches a single message and parses the Gmail payload into
 *   our normalized `ParsedGmailMessage` shape.
 *
 * When Google credentials are absent, mock implementations return deterministic
 * sample data so the polling pipeline and UI work locally without OAuth.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Minimal mailbox shape this module needs (subset of the Prisma model). */
export interface GmailMailbox {
  id: string;
  email: string;
  accessToken?: string | null;
  refreshToken?: string | null;
  historyId?: string | null;
}

/** Normalized message shape mapped onto our `Email` model fields. */
export interface ParsedGmailMessage {
  gmailId: string;
  threadId: string | null;
  fromAddr: string;
  fromName: string | null;
  toAddr: string | null;
  subject: string | null;
  snippet: string | null;
  bodyText: string | null;
  bodyHtml: string | null;
  receivedAt: Date;
  /** The raw Gmail message resource, for auditing / re-parsing. */
  raw: unknown;
}

export interface ListNewMessagesResult {
  /** Gmail message ids that are new since the provided history cursor. */
  messageIds: string[];
  /** Latest history id to persist on the mailbox for the next poll. */
  historyId: string | null;
}

// ---------------------------------------------------------------------------
// OAuth client factory
// ---------------------------------------------------------------------------

/**
 * Create an OAuth2 client. When a mailbox with tokens is provided, its
 * credentials are applied so the client can act on that mailbox's behalf.
 */
export function createOAuthClient(mailbox?: GmailMailbox): OAuth2Client {
  const client = new google.auth.OAuth2(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    env.GOOGLE_REDIRECT_URI,
  );

  if (mailbox?.accessToken || mailbox?.refreshToken) {
    client.setCredentials({
      access_token: mailbox.accessToken ?? undefined,
      refresh_token: mailbox.refreshToken ?? undefined,
    });
  }

  return client;
}

/** Build an authorized Gmail API client for a mailbox. */
function gmailClientFor(mailbox: GmailMailbox): gmail_v1.Gmail {
  const auth = createOAuthClient(mailbox);
  return google.gmail({ version: "v1", auth });
}

/** Scopes required to read and modify mail (used by the auth callback route). */
export const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

// ---------------------------------------------------------------------------
// listNewMessages
// ---------------------------------------------------------------------------

/**
 * List messages that arrived since `historyId`. If no history cursor is given
 * (first sync), returns the most recent inbox messages instead and reports the
 * mailbox's current history id so subsequent polls are incremental.
 */
export async function listNewMessages(
  mailbox: GmailMailbox,
  historyId?: string,
): Promise<ListNewMessagesResult> {
  if (!hasGoogle) {
    return mockListNewMessages(mailbox, historyId);
  }

  const gmail = gmailClientFor(mailbox);
  const cursor = historyId ?? mailbox.historyId ?? undefined;

  // Incremental sync via the History API when we have a cursor.
  if (cursor) {
    try {
      const messageIds = new Set<string>();
      let pageToken: string | undefined;
      let latestHistoryId: string | null = cursor;

      do {
        const { data } = await gmail.users.history.list({
          userId: "me",
          startHistoryId: cursor,
          historyTypes: ["messageAdded"],
          pageToken,
        });

        for (const record of data.history ?? []) {
          for (const added of record.messagesAdded ?? []) {
            const id = added.message?.id;
            if (id) messageIds.add(id);
          }
        }

        if (data.historyId) latestHistoryId = data.historyId;
        pageToken = data.nextPageToken ?? undefined;
      } while (pageToken);

      return { messageIds: [...messageIds], historyId: latestHistoryId };
    } catch (err) {
      // A too-old startHistoryId returns 404. Rather than let this throw (which
      // would skip the mailbox and leave the stale cursor in place forever),
      // fall through to a full first-sync that re-establishes a fresh cursor.
      if (!isHistoryExpired(err)) throw err;
      console.warn(
        `[gmail] historyId ${cursor} expired for ${mailbox.email}; falling back to full sync`
      );
    }
  }

  // First sync (or history-cursor recovery): pull the most recent inbox
  // messages and capture a fresh cursor.
  const { data } = await gmail.users.messages.list({
    userId: "me",
    labelIds: ["INBOX"],
    maxResults: 25,
  });

  const messageIds = (data.messages ?? [])
    .map((m) => m.id)
    .filter((id): id is string => Boolean(id));

  // Get a fresh history id to persist for the next incremental poll.
  const { data: profile } = await gmail.users.getProfile({ userId: "me" });

  return {
    messageIds,
    historyId: profile.historyId ?? null,
  };
}

// ---------------------------------------------------------------------------
// getMessage
// ---------------------------------------------------------------------------

/** Fetch and parse a single Gmail message into our normalized shape. */
export async function getMessage(
  mailbox: GmailMailbox,
  id: string,
): Promise<ParsedGmailMessage> {
  if (!hasGoogle) {
    return mockGetMessage(mailbox, id);
  }

  const gmail = gmailClientFor(mailbox);
  const { data } = await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });

  return parseGmailMessage(data);
}

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Detect the "startHistoryId is too old" condition. Gmail's history.list
 * returns HTTP 404 when the supplied cursor has been expired/pruned. googleapis
 * surfaces the status on `code` and/or `response.status` depending on version.
 */
function isHistoryExpired(err: unknown): boolean {
  const e = err as { code?: number; status?: number; response?: { status?: number } };
  return e?.code === 404 || e?.status === 404 || e?.response?.status === 404;
}

function headerValue(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string | undefined {
  const lower = name.toLowerCase();
  return headers?.find((h) => h.name?.toLowerCase() === lower)?.value ?? undefined;
}

/** Split an RFC5322 address like `"Jane Doe" <jane@x.com>` into name + email. */
function parseAddress(raw: string | undefined): {
  name: string | null;
  email: string;
} {
  if (!raw) return { name: null, email: "" };
  const match = raw.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (match) {
    const name = match[1].trim();
    return { name: name.length > 0 ? name : null, email: match[2].trim() };
  }
  return { name: null, email: raw.trim() };
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

/**
 * Recursively walk the MIME tree collecting the first text/plain and text/html
 * bodies. Handles both single-part and multipart messages.
 */
function extractBodies(payload: gmail_v1.Schema$MessagePart | undefined): {
  text: string | null;
  html: string | null;
} {
  let text: string | null = null;
  let html: string | null = null;

  const walk = (part: gmail_v1.Schema$MessagePart | undefined) => {
    if (!part) return;
    const mime = part.mimeType ?? "";
    const data = part.body?.data;

    if (data) {
      if (mime === "text/plain" && text === null) {
        text = decodeBase64Url(data);
      } else if (mime === "text/html" && html === null) {
        html = decodeBase64Url(data);
      }
    }

    for (const child of part.parts ?? []) {
      walk(child);
    }
  };

  walk(payload);
  return { text, html };
}

/** Map a raw Gmail message resource onto `ParsedGmailMessage`. */
export function parseGmailMessage(
  message: gmail_v1.Schema$Message,
): ParsedGmailMessage {
  const headers = message.payload?.headers;
  const from = parseAddress(headerValue(headers, "From"));
  const to = headerValue(headers, "To") ?? null;
  const subject = headerValue(headers, "Subject") ?? null;

  const { text, html } = extractBodies(message.payload);

  // Prefer the internalDate (ms epoch) for receivedAt; fall back to the Date
  // header, then to now.
  let receivedAt: Date;
  if (message.internalDate) {
    receivedAt = new Date(Number(message.internalDate));
  } else {
    const dateHeader = headerValue(headers, "Date");
    const parsed = dateHeader ? Date.parse(dateHeader) : NaN;
    receivedAt = Number.isNaN(parsed) ? new Date() : new Date(parsed);
  }

  return {
    gmailId: message.id ?? "",
    threadId: message.threadId ?? null,
    fromAddr: from.email,
    fromName: from.name,
    toAddr: to,
    subject,
    snippet: message.snippet ?? null,
    bodyText: text,
    bodyHtml: html,
    receivedAt,
    raw: message,
  };
}

// ---------------------------------------------------------------------------
// Mock implementations (no Google credentials)
// ---------------------------------------------------------------------------

interface MockSeed {
  fromName: string;
  fromAddr: string;
  subject: string;
  snippet: string;
  bodyText: string;
  minutesAgo: number;
}

const MOCK_SEEDS: MockSeed[] = [
  {
    fromName: "Priya Nair",
    fromAddr: "priya.nair@acme-corp.com",
    subject: "Urgent: dashboard is down for our whole team",
    snippet:
      "None of us can log in this morning and we have a client demo in an hour.",
    bodyText:
      "Hi team,\n\nNone of us can log into the dashboard this morning — it just spins. We have a client demo in an hour and this is critical. Please help ASAP.\n\nThanks,\nPriya",
    minutesAgo: 8,
  },
  {
    fromName: "Marcus Bell",
    fromAddr: "marcus@brightloop.io",
    subject: "Interested in a demo and pricing for 40 seats",
    snippet:
      "We're evaluating tools for our support org and would love a walkthrough.",
    bodyText:
      "Hello,\n\nWe're evaluating inbox tools for our 40-person support org. Could we set up a demo this week and get pricing for annual billing?\n\nBest,\nMarcus Bell\nHead of CX, BrightLoop",
    minutesAgo: 42,
  },
  {
    fromName: "Accounts Receivable",
    fromAddr: "billing@vendorworks.com",
    subject: "Invoice #INV-2043 payment failed",
    snippet: "Your recent payment could not be processed. Please update your card.",
    bodyText:
      "Dear customer,\n\nWe were unable to process the payment for invoice #INV-2043 ($480.00). Please update your billing details to avoid service interruption.\n\nRegards,\nAccounts Receivable",
    minutesAgo: 90,
  },
  {
    fromName: "Dana Whitfield",
    fromAddr: "dana.whitfield@gmail.com",
    subject: "Thank you — great support last week!",
    snippet: "Just wanted to say your team was fantastic resolving our issue.",
    bodyText:
      "Hi,\n\nI just wanted to say thank you — your support team was excellent resolving our onboarding issue last week. Really appreciate it!\n\nWarm regards,\nDana",
    minutesAgo: 180,
  },
  {
    fromName: "Rewards Center",
    fromAddr: "no-reply@promo-winners.biz",
    subject: "Congratulations! You are today's lucky winner",
    snippet: "Claim your free reward now — limited time offer, act fast!",
    bodyText:
      "CONGRATULATIONS!!! You have been selected as today's lucky winner. Click here to claim your free reward now. Unsubscribe anytime.",
    minutesAgo: 240,
  },
];

function mockMessageId(mailboxId: string, index: number): string {
  return `mock-${mailboxId}-${index}`;
}

function mockListNewMessages(
  mailbox: GmailMailbox,
  _historyId?: string,
): ListNewMessagesResult {
  void _historyId;
  const messageIds = MOCK_SEEDS.map((_, i) => mockMessageId(mailbox.id, i));
  return {
    messageIds,
    historyId: String(1_000_000 + MOCK_SEEDS.length),
  };
}

function mockGetMessage(
  mailbox: GmailMailbox,
  id: string,
): ParsedGmailMessage {
  // Extract the trailing index from the mock id; default to the first seed.
  const parsedIndex = Number(id.split("-").pop());
  const index =
    Number.isInteger(parsedIndex) && parsedIndex >= 0
      ? parsedIndex % MOCK_SEEDS.length
      : 0;
  const seed = MOCK_SEEDS[index];

  const receivedAt = new Date(Date.now() - seed.minutesAgo * 60_000);

  return {
    gmailId: id,
    threadId: `thread-${mailbox.id}-${index}`,
    fromAddr: seed.fromAddr,
    fromName: seed.fromName,
    toAddr: mailbox.email,
    subject: seed.subject,
    snippet: seed.snippet,
    bodyText: seed.bodyText,
    bodyHtml: `<p>${seed.bodyText.replace(/\n/g, "<br/>")}</p>`,
    receivedAt,
    raw: { mock: true, id, seedIndex: index },
  };
}

/** Exposed for seeding scripts / previews that want the raw sample set. */
export function getMockMessages(mailbox: GmailMailbox): ParsedGmailMessage[] {
  return MOCK_SEEDS.map((_, i) =>
    mockGetMessage(mailbox, mockMessageId(mailbox.id, i)),
  );
}
