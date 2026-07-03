import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock external boundaries ------------------------------------------------
// Prisma: fully mocked so we never touch a real DB. Each method is a vi.fn we
// can make resolve (DB path) or reject (error/fallback path) per test.
vi.mock("@/lib/prisma", () => ({
  prisma: {
    email: {
      update: vi.fn(),
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
    classification: {
      upsert: vi.fn(),
    },
  },
}));

// next/cache: capture revalidatePath calls.
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// OpenAI classifier: mocked so reclassifyEmail is deterministic.
vi.mock("@/services/openai", () => ({
  classifyEmail: vi.fn(),
}));

// Auth: every mutating action now calls requireCurrentUser() first. Return a
// stable authenticated user by default; mockAuthUser can override to null to
// simulate the unauthenticated case (requireCurrentUser throws UNAUTHENTICATED).
const AUTH_USER = {
  id: "user-1",
  orgId: "org-1",
  role: "OWNER" as const,
  email: "u@org.test",
  name: "U",
  supabaseId: "sb-1",
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

let currentUser: typeof AUTH_USER | null = AUTH_USER;

vi.mock("@/lib/auth", () => ({
  getCurrentUser: vi.fn(async () => currentUser),
  requireCurrentUser: vi.fn(async () => {
    if (!currentUser) throw new Error("UNAUTHENTICATED");
    return currentUser;
  }),
}));

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { classifyEmail } from "@/services/openai";
import {
  assignEmail,
  archiveEmail,
  setEmailStatus,
  reclassifyEmail,
  sendReply,
} from "./emails";

const emailUpdate = vi.mocked(prisma.email.update);
const emailFindFirst = vi.mocked(prisma.email.findFirst);
const userFindFirst = vi.mocked(prisma.user.findFirst);
const classificationUpsert = vi.mocked(prisma.classification.upsert);
const revalidate = vi.mocked(revalidatePath);
const mockClassify = vi.mocked(classifyEmail);

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = AUTH_USER;
  // Default happy-path ownership: the email and assignee belong to the org.
  emailFindFirst.mockResolvedValue({ id: "email-1" } as never);
  userFindFirst.mockResolvedValue({ id: "user-9" } as never);
});

// -----------------------------------------------------------------------------
// assignEmail
// -----------------------------------------------------------------------------
describe("assignEmail", () => {
  it("verifies email ownership + assignee org, updates assigneeId, and revalidates", async () => {
    emailUpdate.mockResolvedValue({} as never);

    const res = await assignEmail("email-1", "user-9");

    expect(res).toEqual({ ok: true });
    // Tenant-isolation guard: email must belong to the caller's org.
    expect(emailFindFirst).toHaveBeenCalledWith({
      where: { id: "email-1", mailbox: { orgId: "org-1" } },
      select: { id: true },
    });
    // Assignee must belong to the same org.
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { id: "user-9", orgId: "org-1" },
      select: { id: true },
    });
    expect(emailUpdate).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { assigneeId: "user-9" },
    });
    expect(revalidate).toHaveBeenCalledWith("/inbox");
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("unassigns (null) when userId is null without an assignee org lookup", async () => {
    emailUpdate.mockResolvedValue({} as never);

    const res = await assignEmail("email-1", null);

    expect(res).toEqual({ ok: true });
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(emailUpdate).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { assigneeId: null },
    });
  });

  it("returns 'Email not found' and does NOT update when the email is in another tenant (cross-tenant IDOR guard)", async () => {
    emailFindFirst.mockResolvedValue(null as never);

    const res = await assignEmail("email-1", "user-9");

    expect(res).toEqual({ ok: false, error: "Email not found" });
    expect(userFindFirst).not.toHaveBeenCalled();
    expect(emailUpdate).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("returns 'Assignee not found' and does NOT update when the assignee is in another tenant", async () => {
    userFindFirst.mockResolvedValue(null as never);

    const res = await assignEmail("email-1", "user-9");

    expect(res).toEqual({ ok: false, error: "Assignee not found" });
    expect(emailUpdate).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("returns the UNAUTHENTICATED error and does NOT update when there is no user", async () => {
    currentUser = null;

    const res = await assignEmail("email-1", "user-9");

    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(emailFindFirst).not.toHaveBeenCalled();
    expect(emailUpdate).not.toHaveBeenCalled();
  });

  it("validates emailId before touching the DB", async () => {
    const res = await assignEmail("", "user-1");

    expect(res).toEqual({ ok: false, error: "emailId is required" });
    expect(emailUpdate).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("returns a graceful error result (no throw) when prisma rejects (mock mode)", async () => {
    emailUpdate.mockRejectedValue(
      new Error("DATABASE_URL is not configured — running in mock mode."),
    );

    const res = await assignEmail("email-1", "user-1");

    expect(res).toEqual({
      ok: false,
      error: "DATABASE_URL is not configured — running in mock mode.",
    });
    // No revalidation should happen on the failure path.
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for non-Error throws", async () => {
    emailUpdate.mockRejectedValue("boom");

    const res = await assignEmail("email-1", "user-1");

    expect(res).toEqual({ ok: false, error: "Unexpected error" });
  });
});

// -----------------------------------------------------------------------------
// setEmailStatus / archiveEmail
// -----------------------------------------------------------------------------
describe("setEmailStatus", () => {
  it("verifies email ownership, updates status, and revalidates on the DB path", async () => {
    emailUpdate.mockResolvedValue({} as never);

    const res = await setEmailStatus("email-1", "READ");

    expect(res).toEqual({ ok: true });
    expect(emailFindFirst).toHaveBeenCalledWith({
      where: { id: "email-1", mailbox: { orgId: "org-1" } },
      select: { id: true },
    });
    expect(emailUpdate).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { status: "READ" },
    });
    expect(revalidate).toHaveBeenCalledWith("/inbox");
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("returns 'Email not found' and does NOT update for a cross-tenant email id", async () => {
    emailFindFirst.mockResolvedValue(null as never);

    const res = await setEmailStatus("email-1", "READ");

    expect(res).toEqual({ ok: false, error: "Email not found" });
    expect(emailUpdate).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("returns the UNAUTHENTICATED error when there is no user", async () => {
    currentUser = null;

    const res = await setEmailStatus("email-1", "READ");

    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(emailFindFirst).not.toHaveBeenCalled();
    expect(emailUpdate).not.toHaveBeenCalled();
  });

  it("rejects an invalid status without touching the DB", async () => {
    const res = await setEmailStatus("email-1", "BOGUS" as never);

    expect(res).toEqual({ ok: false, error: "Invalid status: BOGUS" });
    expect(emailUpdate).not.toHaveBeenCalled();
  });

  it("requires emailId", async () => {
    const res = await setEmailStatus("", "READ");

    expect(res).toEqual({ ok: false, error: "emailId is required" });
    expect(emailUpdate).not.toHaveBeenCalled();
  });

  it("returns error toast (no throw) when the write fails in mock mode", async () => {
    emailUpdate.mockRejectedValue(new Error("no db"));

    const res = await setEmailStatus("email-1", "UNREAD");

    expect(res).toEqual({ ok: false, error: "no db" });
    expect(revalidate).not.toHaveBeenCalled();
  });
});

describe("archiveEmail", () => {
  it("delegates to setEmailStatus with ARCHIVED", async () => {
    emailUpdate.mockResolvedValue({} as never);

    const res = await archiveEmail("email-42");

    expect(res).toEqual({ ok: true });
    expect(emailUpdate).toHaveBeenCalledWith({
      where: { id: "email-42" },
      data: { status: "ARCHIVED" },
    });
  });

  it("propagates the emailId validation error", async () => {
    const res = await archiveEmail("");

    expect(res).toEqual({ ok: false, error: "emailId is required" });
    expect(emailUpdate).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
// sendReply
// -----------------------------------------------------------------------------
describe("sendReply", () => {
  it("returns a mocked success in MOCK MODE (no database) without querying prisma", async () => {
    // The test setup strips DATABASE_URL, so hasDatabase === false and the
    // action short-circuits to a mocked send.
    const res = await sendReply("email-1", "Thanks for reaching out!");

    expect(res).toEqual({ ok: true, data: { mocked: true } });
    // Mock mode short-circuits after auth but before any DB access.
    expect(emailFindFirst).not.toHaveBeenCalled();
    expect(emailUpdate).not.toHaveBeenCalled();
    // Mock-mode short-circuit does not revalidate.
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("returns the UNAUTHENTICATED error when there is no user (even in mock mode)", async () => {
    currentUser = null;

    const res = await sendReply("email-1", "Thanks!");

    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(emailUpdate).not.toHaveBeenCalled();
  });

  it("requires emailId", async () => {
    const res = await sendReply("", "hello");
    expect(res).toEqual({ ok: false, error: "emailId is required" });
  });

  it("requires a non-empty reply body", async () => {
    const res = await sendReply("email-1", "   ");
    expect(res).toEqual({ ok: false, error: "Reply body is required" });
  });
});

// -----------------------------------------------------------------------------
// reclassifyEmail
// -----------------------------------------------------------------------------
describe("reclassifyEmail", () => {
  const classification = {
    category: "SUPPORT" as const,
    priority: "HIGH" as const,
    summary: "Customer needs help",
    suggestedReply: "We are on it.",
    sentiment: "NEGATIVE" as const,
    confidence: 0.87,
    assignee: null,
  };

  it("classifies then upserts and revalidates on the DB path", async () => {
    emailFindFirst.mockResolvedValue({
      id: "email-1",
      fromAddr: "customer@acme.com",
      fromName: "Ada",
      subject: "Broken widget",
      bodyText: "It stopped working.",
      snippet: "It stopped...",
    } as never);
    mockClassify.mockResolvedValue(classification);
    classificationUpsert.mockResolvedValue({} as never);

    const res = await reclassifyEmail("email-1");

    expect(res).toEqual({ ok: true });

    // Ownership scoped lookup (findFirst, not findUnique).
    expect(emailFindFirst).toHaveBeenCalledWith({
      where: { id: "email-1", mailbox: { orgId: "org-1" } },
    });

    // Classifier receives normalized email fields (nulls -> undefined).
    expect(mockClassify).toHaveBeenCalledWith({
      fromAddr: "customer@acme.com",
      fromName: "Ada",
      subject: "Broken widget",
      bodyText: "It stopped working.",
    });

    // Upsert uses emailId as the key and stores classifier output. In mock
    // mode (no OpenAI) model is null.
    expect(classificationUpsert).toHaveBeenCalledWith({
      where: { emailId: "email-1" },
      create: {
        emailId: "email-1",
        category: "SUPPORT",
        priority: "HIGH",
        summary: "Customer needs help",
        suggestedReply: "We are on it.",
        sentiment: "NEGATIVE",
        confidence: 0.87,
        assignee: null,
        model: null,
      },
      update: {
        category: "SUPPORT",
        priority: "HIGH",
        summary: "Customer needs help",
        suggestedReply: "We are on it.",
        sentiment: "NEGATIVE",
        confidence: 0.87,
        assignee: null,
        model: null,
      },
    });

    expect(revalidate).toHaveBeenCalledWith("/inbox");
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
  });

  it("falls back to snippet when bodyText is missing", async () => {
    emailFindFirst.mockResolvedValue({
      id: "email-2",
      fromAddr: "a@b.com",
      fromName: null,
      subject: null,
      bodyText: null,
      snippet: "just the snippet",
    } as never);
    mockClassify.mockResolvedValue(classification);
    classificationUpsert.mockResolvedValue({} as never);

    await reclassifyEmail("email-2");

    expect(mockClassify).toHaveBeenCalledWith({
      fromAddr: "a@b.com",
      fromName: undefined,
      subject: undefined,
      bodyText: "just the snippet",
    });
  });

  it("returns 'Email not found' when the email does not exist / is in another tenant", async () => {
    emailFindFirst.mockResolvedValue(null as never);

    const res = await reclassifyEmail("missing");

    expect(res).toEqual({ ok: false, error: "Email not found" });
    expect(mockClassify).not.toHaveBeenCalled();
    expect(classificationUpsert).not.toHaveBeenCalled();
  });

  it("returns the UNAUTHENTICATED error when there is no user", async () => {
    currentUser = null;

    const res = await reclassifyEmail("email-1");

    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(emailFindFirst).not.toHaveBeenCalled();
    expect(classificationUpsert).not.toHaveBeenCalled();
  });

  it("requires emailId", async () => {
    const res = await reclassifyEmail("");
    expect(res).toEqual({ ok: false, error: "emailId is required" });
    expect(emailFindFirst).not.toHaveBeenCalled();
  });

  it("returns a graceful error result when the lookup fails in mock mode", async () => {
    emailFindFirst.mockRejectedValue(new Error("no db"));

    const res = await reclassifyEmail("email-1");

    expect(res).toEqual({ ok: false, error: "no db" });
    expect(classificationUpsert).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });
});
