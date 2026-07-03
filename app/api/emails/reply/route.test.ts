import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Integration tests for POST /api/emails/reply.
 *
 * The route resolves an email (mock inbox in mock mode, else prisma) and pipes
 * `streamSuggestedReply` into a text/plain ReadableStream. We mock the openai
 * service so we control the streamed chunks, and read the response body back
 * out to assert the full concatenated reply.
 *
 * setup.ts strips DATABASE_URL, so `hasDatabase` is false and the route uses
 * the seeded mock inbox (getMockEmailById) by default.
 */

vi.mock("@/services/openai", () => ({
  streamSuggestedReply: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    email: { findFirst: vi.fn() },
  },
}));

// Auth: the route now gates on getCurrentUser() and returns 401 when null.
// Default to an authenticated user; set currentUser = null to exercise the 401.
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

// `@/lib/mock-emails` imports "server-only" (not resolvable under vitest) and
// is a boundary the route reads from in mock mode — mock it directly. We keep a
// single known email so id resolution + "not found" can both be exercised.
const MOCK_EMAIL = {
  id: "mock-0",
  fromAddr: "sarah@acme.io",
  fromName: "Sarah Chen",
  subject: "Unable to access billing dashboard",
  bodyText: "Body of the billing email.",
  snippet: "Customer locked out.",
};

vi.mock("@/lib/mock-emails", () => ({
  getMockEmailById: vi.fn((id: string) =>
    id === MOCK_EMAIL.id ? MOCK_EMAIL : null,
  ),
}));

import { POST } from "./route";
import { streamSuggestedReply } from "@/services/openai";

const mockStream = vi.mocked(streamSuggestedReply);

/** Turn an array of strings into the async generator the route consumes. */
function fakeStream(chunks: string[]) {
  return (async function* () {
    for (const chunk of chunks) yield chunk;
  })();
}

/** Read a Response's ReadableStream body fully into a string. */
async function readBody(res: Response): Promise<string> {
  return await res.text();
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/emails/reply", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = AUTH_USER;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("POST /api/emails/reply", () => {
  it("streams the suggested reply as text/plain for a known mock email", async () => {
    mockStream.mockReturnValue(
      fakeStream(["Hi Sarah,", " thanks", " for reaching out."]),
    );

    // "mock-0" is the first seeded mock email (getMockEmailById).
    const res = await POST(makeRequest({ emailId: "mock-0" }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/plain; charset=utf-8");
    expect(res.headers.get("Cache-Control")).toBe("no-cache, no-transform");

    const text = await readBody(res);
    expect(text).toBe("Hi Sarah, thanks for reaching out.");

    // The route resolved the mock email and forwarded its fields.
    expect(mockStream).toHaveBeenCalledTimes(1);
    expect(mockStream).toHaveBeenCalledWith(
      expect.objectContaining({ fromAddr: "sarah@acme.io" }),
    );
  });

  it("folds a caller instruction into the body context passed to openai", async () => {
    mockStream.mockReturnValue(fakeStream(["ok"]));

    await POST(
      makeRequest({ emailId: "mock-0", instruction: "Keep it short." }),
    );

    const arg = mockStream.mock.calls[0][0];
    expect(arg.bodyText).toContain("Keep it short.");
  });

  it("returns 401 and streams nothing when the caller is unauthenticated", async () => {
    currentUser = null;

    const res = await POST(makeRequest({ emailId: "mock-0" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("returns 400 when emailId is missing", async () => {
    const res = await POST(makeRequest({ instruction: "hello" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      error: "emailId is required",
    });
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid JSON body", async () => {
    const res = await POST(
      new Request("http://localhost/api/emails/reply", {
        method: "POST",
        body: "{ not json",
      }),
    );

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid JSON body" });
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("returns 404 when the email id does not resolve to any mock email", async () => {
    const res = await POST(makeRequest({ emailId: "does-not-exist" }));

    expect(res.status).toBe(404);
    await expect(res.json()).resolves.toEqual({ error: "Email not found" });
    expect(mockStream).not.toHaveBeenCalled();
  });

  it("emits an inline [stream error] marker but still completes when the generator throws mid-stream", async () => {
    mockStream.mockReturnValue(
      (async function* () {
        yield "partial reply";
        throw new Error("upstream exploded");
      })(),
    );

    const res = await POST(makeRequest({ emailId: "mock-0" }));

    // The stream is created lazily; the error surfaces inside the body, not
    // as a non-200 status.
    expect(res.status).toBe(200);
    const text = await readBody(res);
    expect(text).toContain("partial reply");
    expect(text).toContain("[stream error] upstream exploded");
  });

  it("skips empty chunks yielded by the stream", async () => {
    mockStream.mockReturnValue(fakeStream(["a", "", "b"]));

    const res = await POST(makeRequest({ emailId: "mock-0" }));
    const text = await readBody(res);

    expect(text).toBe("ab");
  });
});
