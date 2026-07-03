import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GmailMailbox } from "@/services/gmail";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** base64url-encode a UTF-8 string the way Gmail returns body part data. */
function b64url(text: string): string {
  return Buffer.from(text, "utf-8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

const MAILBOX: GmailMailbox = {
  id: "mbx1",
  email: "owner@example.com",
  accessToken: "at",
  refreshToken: "rt",
  historyId: null,
};

// ---------------------------------------------------------------------------
// parseGmailMessage — the core payload -> Email parsing (pure function).
// ---------------------------------------------------------------------------

describe("parseGmailMessage", () => {
  // These tests run under the default MOCK MODE env; parseGmailMessage is a
  // pure function and does not touch googleapis, so no mocking is required.
  let parseGmailMessage: typeof import("@/services/gmail").parseGmailMessage;

  beforeEach(async () => {
    ({ parseGmailMessage } = await import("@/services/gmail"));
  });

  it("parses a representative multipart message (text/plain + text/html)", () => {
    const message = {
      id: "msg-1",
      threadId: "thr-1",
      snippet: "Hello there, this is the snippet",
      internalDate: "1700000000000",
      payload: {
        mimeType: "multipart/alternative",
        headers: [
          { name: "From", value: '"Jane Doe" <jane@x.com>' },
          { name: "To", value: "owner@example.com" },
          { name: "Subject", value: "Quarterly report" },
          { name: "Date", value: "Tue, 14 Nov 2023 22:13:20 +0000" },
        ],
        parts: [
          {
            mimeType: "text/plain",
            body: { data: b64url("plain body line 1\nline 2") },
          },
          {
            mimeType: "text/html",
            body: { data: b64url("<p>html body</p>") },
          },
        ],
      },
    };

    const parsed = parseGmailMessage(message);

    expect(parsed.gmailId).toBe("msg-1");
    expect(parsed.threadId).toBe("thr-1");
    expect(parsed.fromName).toBe("Jane Doe");
    expect(parsed.fromAddr).toBe("jane@x.com");
    expect(parsed.toAddr).toBe("owner@example.com");
    expect(parsed.subject).toBe("Quarterly report");
    expect(parsed.snippet).toBe("Hello there, this is the snippet");
    expect(parsed.bodyText).toBe("plain body line 1\nline 2");
    expect(parsed.bodyHtml).toBe("<p>html body</p>");
    // internalDate wins over the Date header.
    expect(parsed.receivedAt).toEqual(new Date(1700000000000));
    expect(parsed.raw).toBe(message);
  });

  it("case-insensitively matches header names", () => {
    const parsed = parseGmailMessage({
      id: "m",
      payload: {
        headers: [
          { name: "from", value: "bob@x.com" },
          { name: "SUBJECT", value: "hi" },
        ],
      },
    });
    expect(parsed.fromAddr).toBe("bob@x.com");
    expect(parsed.subject).toBe("hi");
  });

  it("parses a From header with no display name", () => {
    const parsed = parseGmailMessage({
      id: "m",
      payload: { headers: [{ name: "From", value: "solo@x.com" }] },
    });
    expect(parsed.fromName).toBeNull();
    expect(parsed.fromAddr).toBe("solo@x.com");
  });

  it("parses an unquoted display name in angle-bracket form", () => {
    const parsed = parseGmailMessage({
      id: "m",
      payload: { headers: [{ name: "From", value: "Jane Doe <jane@x.com>" }] },
    });
    expect(parsed.fromName).toBe("Jane Doe");
    expect(parsed.fromAddr).toBe("jane@x.com");
  });

  it("handles a single-part text/plain message (no parts array)", () => {
    const parsed = parseGmailMessage({
      id: "m",
      internalDate: "1700000000000",
      payload: {
        mimeType: "text/plain",
        headers: [{ name: "From", value: "a@b.com" }],
        body: { data: b64url("just text") },
      },
    });
    expect(parsed.bodyText).toBe("just text");
    expect(parsed.bodyHtml).toBeNull();
  });

  it("recursively extracts bodies from nested multipart trees", () => {
    const parsed = parseGmailMessage({
      id: "m",
      internalDate: "1",
      payload: {
        mimeType: "multipart/mixed",
        headers: [{ name: "From", value: "a@b.com" }],
        parts: [
          {
            mimeType: "multipart/alternative",
            parts: [
              { mimeType: "text/plain", body: { data: b64url("nested text") } },
              { mimeType: "text/html", body: { data: b64url("<i>nested</i>") } },
            ],
          },
          { mimeType: "application/pdf", body: { data: b64url("ignoreme") } },
        ],
      },
    });
    expect(parsed.bodyText).toBe("nested text");
    expect(parsed.bodyHtml).toBe("<i>nested</i>");
  });

  it("keeps the FIRST text/plain and text/html when duplicates exist", () => {
    const parsed = parseGmailMessage({
      id: "m",
      internalDate: "1",
      payload: {
        parts: [
          { mimeType: "text/plain", body: { data: b64url("first") } },
          { mimeType: "text/plain", body: { data: b64url("second") } },
        ],
      },
    });
    expect(parsed.bodyText).toBe("first");
  });

  it("falls back to the Date header when internalDate is absent", () => {
    const parsed = parseGmailMessage({
      id: "m",
      payload: {
        headers: [{ name: "Date", value: "Tue, 14 Nov 2023 22:13:20 +0000" }],
      },
    });
    expect(parsed.receivedAt).toEqual(new Date("Tue, 14 Nov 2023 22:13:20 +0000"));
  });

  it("falls back to now when neither internalDate nor a valid Date header exist", () => {
    vi.useFakeTimers();
    const fixed = new Date("2026-07-03T12:00:00.000Z");
    vi.setSystemTime(fixed);
    try {
      const noDate = parseGmailMessage({ id: "m", payload: { headers: [] } });
      expect(noDate.receivedAt).toEqual(fixed);

      const badDate = parseGmailMessage({
        id: "m",
        payload: { headers: [{ name: "Date", value: "not-a-real-date" }] },
      });
      expect(badDate.receivedAt).toEqual(fixed);
    } finally {
      vi.useRealTimers();
    }
  });

  it("handles a completely empty/missing payload gracefully", () => {
    const parsed = parseGmailMessage({});
    expect(parsed.gmailId).toBe("");
    expect(parsed.threadId).toBeNull();
    expect(parsed.fromAddr).toBe("");
    expect(parsed.fromName).toBeNull();
    expect(parsed.toAddr).toBeNull();
    expect(parsed.subject).toBeNull();
    expect(parsed.snippet).toBeNull();
    expect(parsed.bodyText).toBeNull();
    expect(parsed.bodyHtml).toBeNull();
    expect(parsed.receivedAt).toBeInstanceOf(Date);
  });
});

// ---------------------------------------------------------------------------
// Static exports.
// ---------------------------------------------------------------------------

describe("static exports", () => {
  it("exposes the required gmail read/modify scopes", async () => {
    const { GMAIL_SCOPES } = await import("@/services/gmail");
    expect(GMAIL_SCOPES).toEqual([
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Mock-mode functions (no Google creds — the default test env).
// ---------------------------------------------------------------------------

describe("mock mode (hasGoogle === false)", () => {
  let mod: typeof import("@/services/gmail");

  beforeEach(async () => {
    vi.resetModules();
    mod = await import("@/services/gmail");
  });

  it("listNewMessages returns one id per mock seed and a history cursor", async () => {
    const result = await mod.listNewMessages(MAILBOX);
    expect(Array.isArray(result.messageIds)).toBe(true);
    expect(result.messageIds.length).toBeGreaterThan(0);
    for (const id of result.messageIds) {
      expect(id).toMatch(/^mock-mbx1-\d+$/);
    }
    expect(typeof result.historyId).toBe("string");
    // historyId is deterministic: 1_000_000 + seed count.
    expect(result.historyId).toBe(
      String(1_000_000 + result.messageIds.length),
    );
  });

  it("listNewMessages ignores the historyId argument in mock mode", async () => {
    const a = await mod.listNewMessages(MAILBOX);
    const b = await mod.listNewMessages(MAILBOX, "99999");
    expect(b).toEqual(a);
  });

  it("getMessage returns a well-shaped ParsedGmailMessage for a mock id", async () => {
    const [firstId] = (await mod.listNewMessages(MAILBOX)).messageIds;
    const msg = await mod.getMessage(MAILBOX, firstId);

    expect(msg.gmailId).toBe(firstId);
    expect(msg.threadId).toBe("thread-mbx1-0");
    expect(msg.toAddr).toBe(MAILBOX.email);
    expect(typeof msg.fromAddr).toBe("string");
    expect(msg.fromAddr).toContain("@");
    expect(msg.fromName).toBeTruthy();
    expect(msg.subject).toBeTruthy();
    expect(msg.snippet).toBeTruthy();
    expect(msg.bodyText).toBeTruthy();
    // bodyHtml is derived from bodyText with newlines converted to <br/>.
    expect(msg.bodyHtml).toContain("<p>");
    expect(msg.bodyHtml).not.toContain("\n");
    expect(msg.receivedAt).toBeInstanceOf(Date);
    expect(msg.raw).toMatchObject({ mock: true, id: firstId, seedIndex: 0 });
  });

  it("getMessage maps the trailing index and wraps out-of-range indices", async () => {
    const { messageIds } = await mod.listNewMessages(MAILBOX);
    const seedCount = messageIds.length;

    const wrapped = await mod.getMessage(
      MAILBOX,
      `mock-mbx1-${seedCount}`, // one past the end -> wraps to index 0
    );
    const first = await mod.getMessage(MAILBOX, "mock-mbx1-0");
    expect(wrapped.subject).toBe(first.subject);
    expect(wrapped.raw).toMatchObject({ seedIndex: 0 });
  });

  it("getMessage defaults to the first seed for a non-numeric id", async () => {
    const msg = await mod.getMessage(MAILBOX, "totally-bogus");
    expect(msg.raw).toMatchObject({ seedIndex: 0 });
  });

  it("getMockMessages returns one parsed message per seed with distinct content", async () => {
    const msgs = mod.getMockMessages(MAILBOX);
    const { messageIds } = await mod.listNewMessages(MAILBOX);
    expect(msgs).toHaveLength(messageIds.length);

    const subjects = new Set(msgs.map((m) => m.subject));
    expect(subjects.size).toBe(msgs.length); // all distinct

    msgs.forEach((m, i) => {
      expect(m.gmailId).toBe(`mock-mbx1-${i}`);
      expect(m.threadId).toBe(`thread-mbx1-${i}`);
      expect(m.toAddr).toBe(MAILBOX.email);
      expect(m.receivedAt).toBeInstanceOf(Date);
    });
  });

  it("createOAuthClient builds a client and applies mailbox credentials", async () => {
    const client = mod.createOAuthClient(MAILBOX);
    expect(client).toBeDefined();
    expect(client.credentials.access_token).toBe("at");
    expect(client.credentials.refresh_token).toBe("rt");
  });

  it("createOAuthClient works without a mailbox (no credentials set)", async () => {
    const client = mod.createOAuthClient();
    expect(client).toBeDefined();
    expect(client.credentials.access_token).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Real mode (hasGoogle === true) — googleapis is fully mocked, no network.
// ---------------------------------------------------------------------------

describe("real mode (hasGoogle === true, googleapis mocked)", () => {
  const historyList = vi.fn();
  const messagesList = vi.fn();
  const messagesGet = vi.fn();
  const getProfile = vi.fn();
  const setCredentials = vi.fn();

  const gmailFactory = vi.fn(() => ({
    users: {
      history: { list: historyList },
      messages: { list: messagesList, get: messagesGet },
      getProfile,
    },
  }));

  function loadModule() {
    vi.resetModules();

    vi.doMock("@/lib/env", () => ({
      hasGoogle: true,
      env: {
        GOOGLE_CLIENT_ID: "cid",
        GOOGLE_CLIENT_SECRET: "secret",
        GOOGLE_REDIRECT_URI: "http://localhost/cb",
      },
    }));

    class FakeOAuth2 {
      credentials: Record<string, unknown> = {};
      setCredentials(creds: Record<string, unknown>) {
        setCredentials(creds);
        this.credentials = creds;
      }
    }

    vi.doMock("googleapis", () => ({
      google: {
        auth: { OAuth2: FakeOAuth2 },
        gmail: gmailFactory,
      },
    }));

    return import("@/services/gmail");
  }

  beforeEach(() => {
    historyList.mockReset();
    messagesList.mockReset();
    messagesGet.mockReset();
    getProfile.mockReset();
    setCredentials.mockReset();
    gmailFactory.mockClear();
  });

  afterEach(() => {
    vi.doUnmock("@/lib/env");
    vi.doUnmock("googleapis");
    vi.resetModules();
  });

  it("first sync (no cursor): lists INBOX messages and captures a profile historyId", async () => {
    messagesList.mockResolvedValue({
      data: { messages: [{ id: "a" }, { id: null }, { id: "b" }] },
    });
    getProfile.mockResolvedValue({ data: { historyId: "555" } });

    const mod = await loadModule();
    const result = await mod.listNewMessages({ id: "m", email: "e@x.com" });

    // null ids are filtered out.
    expect(result.messageIds).toEqual(["a", "b"]);
    expect(result.historyId).toBe("555");
    expect(messagesList).toHaveBeenCalledWith({
      userId: "me",
      labelIds: ["INBOX"],
      maxResults: 25,
    });
    expect(historyList).not.toHaveBeenCalled();
  });

  it("incremental sync (with cursor): dedupes messageAdded ids and paginates", async () => {
    historyList
      .mockResolvedValueOnce({
        data: {
          history: [
            { messagesAdded: [{ message: { id: "x" } }, { message: { id: "y" } }] },
          ],
          historyId: "100",
          nextPageToken: "page2",
        },
      })
      .mockResolvedValueOnce({
        data: {
          history: [
            { messagesAdded: [{ message: { id: "y" } }, { message: { id: "z" } }] },
          ],
          historyId: "200",
        },
      });

    const mod = await loadModule();
    const result = await mod.listNewMessages(
      { id: "m", email: "e@x.com" },
      "50",
    );

    expect(new Set(result.messageIds)).toEqual(new Set(["x", "y", "z"]));
    expect(result.messageIds).toHaveLength(3); // deduped
    expect(result.historyId).toBe("200"); // latest across pages
    expect(historyList).toHaveBeenCalledTimes(2);
    expect(historyList).toHaveBeenNthCalledWith(1, {
      userId: "me",
      startHistoryId: "50",
      historyTypes: ["messageAdded"],
      pageToken: undefined,
    });
    expect(historyList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pageToken: "page2" }),
    );
  });

  it("uses mailbox.historyId as the cursor when no explicit historyId is passed", async () => {
    historyList.mockResolvedValue({ data: { history: [], historyId: "9" } });

    const mod = await loadModule();
    await mod.listNewMessages({ id: "m", email: "e@x.com", historyId: "77" });

    expect(historyList).toHaveBeenCalledWith(
      expect.objectContaining({ startHistoryId: "77" }),
    );
  });

  it("getMessage fetches format=full and parses the payload", async () => {
    messagesGet.mockResolvedValue({
      data: {
        id: "gid",
        threadId: "tid",
        internalDate: "1700000000000",
        payload: {
          headers: [
            { name: "From", value: "Ada <ada@x.com>" },
            { name: "Subject", value: "Hi" },
          ],
          mimeType: "text/plain",
          body: {
            data: Buffer.from("hello", "utf-8").toString("base64"),
          },
        },
      },
    });

    const mod = await loadModule();
    const msg = await mod.getMessage({ id: "m", email: "e@x.com" }, "gid");

    expect(messagesGet).toHaveBeenCalledWith({
      userId: "me",
      id: "gid",
      format: "full",
    });
    expect(msg.gmailId).toBe("gid");
    expect(msg.fromName).toBe("Ada");
    expect(msg.fromAddr).toBe("ada@x.com");
    expect(msg.bodyText).toBe("hello");
  });

  it("propagates errors from the Gmail API", async () => {
    messagesGet.mockRejectedValue(new Error("boom"));
    const mod = await loadModule();
    await expect(
      mod.getMessage({ id: "m", email: "e@x.com" }, "gid"),
    ).rejects.toThrow("boom");
  });
});
