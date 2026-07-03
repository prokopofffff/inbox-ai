import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// mock-emails.ts imports "server-only", a Next.js-provided module that Next
// aliases at build time and that must be resolvable under Vitest for this file
// to load. A tiny stub package lives at node_modules/server-only (created by the
// test setup). This vi.mock is a belt-and-suspenders fallback so the module
// resolves to an empty object even if that stub is ever missing.
vi.mock("server-only", () => ({}));

import { getMockEmailById, getMockEmails, MOCK_USERS } from "@/lib/mock-emails";
import {
  CATEGORY_VALUES,
  EMAIL_STATUS_VALUES,
  PRIORITY_VALUES,
  ROLE_VALUES,
  SENTIMENT_VALUES,
} from "@/lib/schemas";

const FIXED_NOW = new Date("2026-07-03T12:00:00.000Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(FIXED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("getMockEmails", () => {
  it("returns a non-empty list", () => {
    expect(getMockEmails(FIXED_NOW).length).toBeGreaterThan(0);
  });

  it("gives every email a unique id and gmailId", () => {
    const emails = getMockEmails(FIXED_NOW);
    const ids = emails.map((e) => e.id);
    const gmailIds = emails.map((e) => e.gmailId);
    expect(new Set(ids).size).toBe(emails.length);
    expect(new Set(gmailIds).size).toBe(emails.length);
  });

  it("every email has a classification with valid enum values", () => {
    for (const email of getMockEmails(FIXED_NOW)) {
      const c = email.classification;
      expect(c).not.toBeNull();
      expect(CATEGORY_VALUES).toContain(c!.category);
      expect(PRIORITY_VALUES).toContain(c!.priority);
      expect(SENTIMENT_VALUES).toContain(c!.sentiment);
      expect(email.status).toBeDefined();
      expect(EMAIL_STATUS_VALUES).toContain(email.status);
    }
  });

  it("every classification confidence is within [0, 1]", () => {
    for (const email of getMockEmails(FIXED_NOW)) {
      const conf = email.classification!.confidence;
      expect(conf).toBeGreaterThanOrEqual(0);
      expect(conf).toBeLessThanOrEqual(1);
    }
  });

  it("classification.emailId matches its parent email id", () => {
    for (const email of getMockEmails(FIXED_NOW)) {
      expect(email.classification!.emailId).toBe(email.id);
    }
  });

  it("keeps summary consistent between email snippet, classification and reply non-empty", () => {
    for (const email of getMockEmails(FIXED_NOW)) {
      expect(email.classification!.summary).toBe(email.snippet);
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.bodyText!.length).toBeGreaterThan(0);
      expect(email.classification!.suggestedReply.length).toBeGreaterThan(0);
    }
  });

  it("computes receivedAt in the past relative to now, and matches classification.createdAt", () => {
    for (const email of getMockEmails(FIXED_NOW)) {
      expect(email.receivedAt.getTime()).toBeLessThanOrEqual(FIXED_NOW.getTime());
      expect(email.classification!.createdAt.getTime()).toBe(
        email.receivedAt.getTime(),
      );
    }
  });

  it("is deterministic for a fixed `now`", () => {
    const a = getMockEmails(FIXED_NOW);
    const b = getMockEmails(FIXED_NOW);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("defaults `now` to the (faked) current time when omitted", () => {
    const emails = getMockEmails();
    // First seed is 2 minutes ago -> receivedAt = now - 120_000ms.
    const first = emails[0];
    expect(FIXED_NOW.getTime() - first.receivedAt.getTime()).toBe(2 * 60 * 1000);
  });

  it("marks the first three as UNREAD and the rest READ", () => {
    const emails = getMockEmails(FIXED_NOW);
    emails.forEach((e, i) => {
      expect(e.status).toBe(i < 3 ? "UNREAD" : "READ");
    });
  });

  it("attaches a consistent mock mailbox to every email", () => {
    for (const email of getMockEmails(FIXED_NOW)) {
      expect(email.mailboxId).toBe("mock-mailbox");
      expect(email.mailbox).toEqual({
        id: "mock-mailbox",
        email: "team@inboxai.dev",
        provider: "gmail",
      });
    }
  });
});

describe("getMockEmailById", () => {
  it("returns the matching email", () => {
    const all = getMockEmails(FIXED_NOW);
    const target = all[2];
    const found = getMockEmailById(target.id, FIXED_NOW);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(target.id);
    expect(found!.subject).toBe(target.subject);
  });

  it("returns null for an unknown id", () => {
    expect(getMockEmailById("does-not-exist", FIXED_NOW)).toBeNull();
  });
});

describe("MOCK_USERS", () => {
  it("has unique ids and valid roles", () => {
    expect(MOCK_USERS.length).toBeGreaterThan(0);
    const ids = MOCK_USERS.map((u) => u.id);
    expect(new Set(ids).size).toBe(MOCK_USERS.length);
    for (const u of MOCK_USERS) {
      expect(ROLE_VALUES).toContain(u.role);
      expect(u.email).toMatch(/@/);
      expect(u.name.length).toBeGreaterThan(0);
    }
  });
});
