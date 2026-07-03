import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for GET /api/cron/poll.
 *
 * The route wires together: prisma (DB), the gmail service (listNewMessages /
 * getMessage) and the openai service (classifyEmail). All three are mocked at
 * the module boundary so we assert the pipeline plumbing — not the real
 * external calls or the pure rule-matching helpers.
 *
 * Note: `env.CRON_SECRET` is read at import time, so tests that care about the
 * auth guard set the env var and re-import the route via `vi.resetModules`.
 */

// ---------------------------------------------------------------------------
// Mocks for the external boundaries.
// ---------------------------------------------------------------------------

vi.mock("@/services/gmail", () => ({
  listNewMessages: vi.fn(),
  getMessage: vi.fn(),
}));

vi.mock("@/services/openai", () => ({
  classifyEmail: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    mailbox: { findMany: vi.fn(), update: vi.fn() },
    email: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    classification: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    automationRule: { findMany: vi.fn() },
    user: { findFirst: vi.fn() },
  },
}));

import { listNewMessages, getMessage } from "@/services/gmail";
import { classifyEmail } from "@/services/openai";
import { prisma } from "@/lib/prisma";

// Typed handles to the mocked functions.
const mockListNewMessages = vi.mocked(listNewMessages);
const mockGetMessage = vi.mocked(getMessage);
const mockClassifyEmail = vi.mocked(classifyEmail);
const mockPrisma = prisma as unknown as {
  mailbox: { findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  email: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  classification: {
    findUnique: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  automationRule: { findMany: ReturnType<typeof vi.fn> };
  user: { findFirst: ReturnType<typeof vi.fn> };
};

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

function makeMailbox(overrides: Record<string, unknown> = {}) {
  return {
    id: "mb-1",
    orgId: "org-1",
    email: "team@inboxai.dev",
    accessToken: "at",
    refreshToken: "rt",
    historyId: null,
    ...overrides,
  };
}

function makeParsedMessage(id: string, overrides: Record<string, unknown> = {}) {
  return {
    gmailId: id,
    threadId: `thread-${id}`,
    fromAddr: "sender@example.com",
    fromName: "Sender",
    toAddr: "team@inboxai.dev",
    subject: "Hello",
    snippet: "snippet",
    bodyText: "body text",
    bodyHtml: "<p>body</p>",
    receivedAt: new Date("2026-01-01T00:00:00Z"),
    raw: { mock: true },
    ...overrides,
  };
}

function makeClassification(overrides: Record<string, unknown> = {}) {
  return {
    category: "SUPPORT",
    priority: "HIGH",
    summary: "A support request.",
    suggestedReply: "Hi, we'll help.",
    sentiment: "NEUTRAL",
    confidence: 0.9,
    assignee: null,
    ...overrides,
  };
}

/** Default happy-path prisma wiring for a single new message. */
function wireHappyPath() {
  mockPrisma.mailbox.findMany.mockResolvedValue([makeMailbox()]);
  mockPrisma.mailbox.update.mockResolvedValue(undefined);
  mockListNewMessages.mockResolvedValue({
    messageIds: ["g-1"],
    historyId: "hist-100",
  });
  // No pre-existing email (both the outer skip check + inner race check).
  mockPrisma.email.findUnique.mockResolvedValue(null);
  mockGetMessage.mockResolvedValue(makeParsedMessage("g-1"));
  mockPrisma.email.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({
      id: "email-1",
      fromAddr: data.fromAddr,
      fromName: data.fromName,
      subject: data.subject,
      bodyText: data.bodyText,
      snippet: data.snippet,
      gmailId: data.gmailId,
    }),
  );
  mockClassifyEmail.mockResolvedValue(makeClassification());
  mockPrisma.classification.create.mockResolvedValue({ id: "cls-1" });
  mockPrisma.classification.findUnique.mockResolvedValue(null);
  mockPrisma.classification.update.mockResolvedValue({ id: "cls-1" });
  mockPrisma.automationRule.findMany.mockResolvedValue([]);
  mockPrisma.email.update.mockResolvedValue({ id: "email-1" });
  mockPrisma.user.findFirst.mockResolvedValue(null);
}

// Silence expected console.error from per-message/per-rule failure branches.
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** Import a fresh copy of the route so import-time env reads take effect. */
async function importRoute() {
  const mod = await import("./route");
  return mod.GET;
}

// ---------------------------------------------------------------------------
// Auth guard.
// ---------------------------------------------------------------------------

describe("GET /api/cron/poll — CRON_SECRET guard", () => {
  it("returns 401 when a secret is configured and no auth is provided", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.resetModules();
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    // Guard must short-circuit before touching the DB.
    expect(mockPrisma.mailbox.findMany).not.toHaveBeenCalled();
  });

  it("returns 401 when the wrong secret is provided", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.resetModules();
    const GET = await importRoute();

    const res = await GET(
      new Request("http://localhost/api/cron/poll", {
        headers: { authorization: "Bearer wrong" },
      }),
    );

    expect(res.status).toBe(401);
    expect(mockPrisma.mailbox.findMany).not.toHaveBeenCalled();
  });

  it("proceeds with a correct Bearer token", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.resetModules();
    wireHappyPath();
    const GET = await importRoute();

    const res = await GET(
      new Request("http://localhost/api/cron/poll", {
        headers: { authorization: "Bearer s3cr3t" },
      }),
    );

    expect(res.status).toBe(200);
    expect(mockPrisma.mailbox.findMany).toHaveBeenCalledTimes(1);
  });

  it("accepts the secret via the x-cron-secret header (case-insensitive scheme aside)", async () => {
    vi.stubEnv("CRON_SECRET", "s3cr3t");
    vi.resetModules();
    wireHappyPath();
    const GET = await importRoute();

    const res = await GET(
      new Request("http://localhost/api/cron/poll", {
        headers: { "x-cron-secret": "s3cr3t" },
      }),
    );

    expect(res.status).toBe(200);
  });

  it("allows invocation without auth when no secret is configured (mock mode)", async () => {
    // setup.ts deletes CRON_SECRET, so it is undefined here.
    wireHappyPath();
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));

    expect(res.status).toBe(200);
    expect(mockPrisma.mailbox.findMany).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Pipeline.
// ---------------------------------------------------------------------------

describe("GET /api/cron/poll — pipeline", () => {
  it("fetches, stores, classifies and returns the summary for a new message", async () => {
    wireHappyPath();
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      processed: 1,
      classified: 1,
      skipped: 0,
      mailboxes: 1,
      gmailEnabled: false,
      openaiEnabled: false,
    });

    // Message was fetched and persisted as an Email.
    expect(mockGetMessage).toHaveBeenCalledWith(
      expect.objectContaining({ id: "mb-1" }),
      "g-1",
    );
    expect(mockPrisma.email.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.email.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gmailId: "g-1",
          mailboxId: "mb-1",
          status: "UNREAD",
        }),
      }),
    );

    // Classified and a Classification row saved.
    expect(mockClassifyEmail).toHaveBeenCalledTimes(1);
    expect(mockPrisma.classification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          emailId: "email-1",
          category: "SUPPORT",
          priority: "HIGH",
          // openai disabled in mock mode -> model is null.
          model: null,
        }),
      }),
    );
  });

  it("persists the advanced historyId when it changes", async () => {
    wireHappyPath();
    const GET = await importRoute();

    await GET(new Request("http://localhost/api/cron/poll"));

    expect(mockPrisma.mailbox.update).toHaveBeenCalledWith({
      where: { id: "mb-1" },
      data: { historyId: "hist-100" },
    });
  });

  it("does not update historyId when it is unchanged", async () => {
    wireHappyPath();
    mockPrisma.mailbox.findMany.mockResolvedValue([
      makeMailbox({ historyId: "hist-100" }),
    ]);
    const GET = await importRoute();

    await GET(new Request("http://localhost/api/cron/poll"));

    expect(mockPrisma.mailbox.update).not.toHaveBeenCalled();
  });

  it("skips messages whose gmailId is already stored (idempotent)", async () => {
    wireHappyPath();
    // Outer existence check finds a row -> skip before fetching the message.
    mockPrisma.email.findUnique.mockResolvedValue({ id: "existing" });
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    expect(body.processed).toBe(0);
    expect(body.classified).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockGetMessage).not.toHaveBeenCalled();
    expect(mockPrisma.email.create).not.toHaveBeenCalled();
  });

  it("applies a matching automation rule (SET_PRIORITY) to the stored email", async () => {
    wireHappyPath();
    mockPrisma.automationRule.findMany.mockResolvedValue([
      {
        id: "rule-1",
        orgId: "org-1",
        enabled: true,
        conditionField: "SUBJECT",
        operator: "CONTAINS",
        value: "Hello",
        actionType: "SET_PRIORITY",
        actionValue: "urgent",
      },
    ]);
    // Classification already exists for the SET_PRIORITY upsert path.
    mockPrisma.classification.findUnique.mockResolvedValue({ id: "cls-1" });
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    expect(body.rulesApplied).toBe(1);
    expect(mockPrisma.classification.update).toHaveBeenCalledWith({
      where: { emailId: "email-1" },
      data: { priority: "URGENT" },
    });
  });

  it("does not apply a rule whose condition does not match", async () => {
    wireHappyPath();
    mockPrisma.automationRule.findMany.mockResolvedValue([
      {
        id: "rule-2",
        orgId: "org-1",
        enabled: true,
        conditionField: "SUBJECT",
        operator: "CONTAINS",
        value: "no-such-token",
        actionType: "SET_PRIORITY",
        actionValue: "urgent",
      },
    ]);
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    expect(body.rulesApplied).toBe(0);
    expect(mockPrisma.classification.update).not.toHaveBeenCalled();
  });

  it("no-ops cleanly when there are no mailboxes", async () => {
    mockPrisma.mailbox.findMany.mockResolvedValue([]);
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({ processed: 0, classified: 0, mailboxes: 0 });
    expect(mockListNewMessages).not.toHaveBeenCalled();
  });

  it("returns 503 when the database is unavailable", async () => {
    mockPrisma.mailbox.findMany.mockRejectedValue(new Error("no DB in mock mode"));
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.error).toBe("Database unavailable");
    expect(body.detail).toBe("no DB in mock mode");
  });

  it("continues past a mailbox whose gmail listing fails", async () => {
    wireHappyPath();
    mockPrisma.mailbox.findMany.mockResolvedValue([
      makeMailbox({ id: "mb-fail" }),
      makeMailbox({ id: "mb-ok" }),
    ]);
    mockListNewMessages
      .mockRejectedValueOnce(new Error("gmail down"))
      .mockResolvedValueOnce({ messageIds: ["g-9"], historyId: "h" });
    mockGetMessage.mockResolvedValue(makeParsedMessage("g-9"));
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    // First mailbox aborted; second still processed its one message.
    expect(body.mailboxes).toBe(2);
    expect(body.processed).toBe(1);
    expect(errorSpy).toHaveBeenCalled();
  });

  it("counts the email as processed but not classified when classification throws", async () => {
    wireHappyPath();
    mockClassifyEmail.mockRejectedValue(new Error("openai boom"));
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    expect(body.processed).toBe(1);
    expect(body.classified).toBe(0);
    // Email was still stored despite the classification failure.
    expect(mockPrisma.email.create).toHaveBeenCalledTimes(1);
    expect(mockPrisma.classification.create).not.toHaveBeenCalled();
  });

  it("skips at the inner race check when the email appears between list and store", async () => {
    wireHappyPath();
    // Outer findUnique: null (not stored) -> proceeds to fetch.
    // Inner findUnique (inside processMessage): row exists -> skip.
    mockPrisma.email.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "race-winner" });
    const GET = await importRoute();

    const res = await GET(new Request("http://localhost/api/cron/poll"));
    const body = await res.json();

    expect(body.processed).toBe(0);
    expect(body.skipped).toBe(1);
    expect(mockGetMessage).toHaveBeenCalledTimes(1);
    expect(mockPrisma.email.create).not.toHaveBeenCalled();
  });
});
