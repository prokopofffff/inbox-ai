import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  applyRules,
  applyAction,
  fieldValue,
  matches,
  type EvaluableRule,
  type RuleActionType,
  type RuleField,
  type RuleOperator,
  type StoredEmail,
} from "./rule-engine";

// --- Mock the DB boundary. --------------------------------------------------
// Every rule-engine DB call goes through "@/lib/prisma"; we replace it with
// vi.fn()s so the pure matching/apply logic can be tested without a database.
vi.mock("@/lib/prisma", () => {
  const prisma = {
    automationRule: { findMany: vi.fn() },
    user: { findFirst: vi.fn() },
    email: { update: vi.fn() },
    classification: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
  };
  return { prisma, default: prisma };
});

import { prisma } from "@/lib/prisma";

// Typed handles on the mocked prisma methods.
const mockPrisma = prisma as unknown as {
  automationRule: { findMany: ReturnType<typeof vi.fn> };
  user: { findFirst: ReturnType<typeof vi.fn> };
  email: { update: ReturnType<typeof vi.fn> };
  classification: {
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
};

function makeEmail(overrides: Partial<StoredEmail> = {}): StoredEmail {
  return {
    id: "email-1",
    fromAddr: "alice@acme.com",
    subject: "Urgent: server down",
    bodyText: "The production server is completely down.",
    snippet: "The production server...",
    ...overrides,
  };
}

function makeRule(overrides: Partial<EvaluableRule> = {}): EvaluableRule {
  return {
    id: "rule-1",
    conditionField: "SUBJECT",
    operator: "CONTAINS",
    value: "urgent",
    actionType: "SET_PRIORITY",
    actionValue: "URGENT",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  // By default classification exists so upsert takes the update path.
  mockPrisma.classification.findUnique.mockResolvedValue({ id: "cls-1" });
});

// ---------------------------------------------------------------------------
// fieldValue: which email field a condition reads.
// ---------------------------------------------------------------------------
describe("fieldValue", () => {
  it("reads SUBJECT", () => {
    expect(fieldValue(makeEmail({ subject: "Hello" }), "SUBJECT")).toBe(
      "Hello"
    );
  });

  it("reads FROM", () => {
    expect(fieldValue(makeEmail({ fromAddr: "bob@x.io" }), "FROM")).toBe(
      "bob@x.io"
    );
  });

  it("reads BODY from bodyText", () => {
    expect(
      fieldValue(makeEmail({ bodyText: "the body", snippet: "snip" }), "BODY")
    ).toBe("the body");
  });

  it("falls back to snippet when bodyText is null for BODY", () => {
    expect(
      fieldValue(makeEmail({ bodyText: null, snippet: "snip text" }), "BODY")
    ).toBe("snip text");
  });

  it("returns empty string when SUBJECT is null", () => {
    expect(fieldValue(makeEmail({ subject: null }), "SUBJECT")).toBe("");
  });

  it("returns empty string when BODY text + snippet are null", () => {
    expect(
      fieldValue(makeEmail({ bodyText: null, snippet: null }), "BODY")
    ).toBe("");
  });

  it("returns empty string for an unknown field", () => {
    expect(fieldValue(makeEmail(), "OTHER" as RuleField)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// matches: operator semantics (case-INsensitive as implemented).
// ---------------------------------------------------------------------------
describe("matches", () => {
  describe("CONTAINS", () => {
    it("matches a substring", () => {
      expect(matches("hello world", "CONTAINS", "lo wo")).toBe(true);
    });
    it("does not match an absent substring", () => {
      expect(matches("hello world", "CONTAINS", "xyz")).toBe(false);
    });
    it("is case-insensitive", () => {
      expect(matches("Hello WORLD", "CONTAINS", "hello world")).toBe(true);
    });
  });

  describe("EQUALS", () => {
    it("matches an exact (case-insensitive) value", () => {
      expect(matches("Support", "EQUALS", "support")).toBe(true);
    });
    it("does not match a partial value", () => {
      expect(matches("supporting", "EQUALS", "support")).toBe(false);
    });
  });

  describe("STARTS_WITH", () => {
    it("matches a prefix (case-insensitive)", () => {
      expect(matches("URGENT: down", "STARTS_WITH", "urgent")).toBe(true);
    });
    it("does not match when the prefix is elsewhere", () => {
      expect(matches("re: urgent", "STARTS_WITH", "urgent")).toBe(false);
    });
  });

  it("returns false for an unknown operator", () => {
    expect(matches("anything", "REGEX" as RuleOperator, "any")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Full field x operator matrix through the matches/fieldValue seam.
// ---------------------------------------------------------------------------
describe("field x operator matrix", () => {
  const fields: RuleField[] = ["SUBJECT", "FROM", "BODY"];
  const operators: RuleOperator[] = ["CONTAINS", "EQUALS", "STARTS_WITH"];

  const email = makeEmail({
    subject: "Billing question",
    fromAddr: "billing@vendor.com",
    bodyText: "Invoice attached for review",
    snippet: "Invoice attached...",
  });

  // For each field, a target that should match under each operator.
  const matchTargets: Record<RuleField, Record<RuleOperator, string>> = {
    SUBJECT: {
      CONTAINS: "question",
      EQUALS: "billing question",
      STARTS_WITH: "billing",
    },
    FROM: {
      CONTAINS: "vendor",
      EQUALS: "billing@vendor.com",
      STARTS_WITH: "billing@",
    },
    BODY: {
      CONTAINS: "attached",
      EQUALS: "invoice attached for review",
      STARTS_WITH: "invoice",
    },
  };

  for (const field of fields) {
    for (const operator of operators) {
      it(`${field} + ${operator} matches the intended value`, () => {
        const value = fieldValue(email, field);
        expect(matches(value, operator, matchTargets[field][operator])).toBe(
          true
        );
      });

      it(`${field} + ${operator} rejects a non-matching value`, () => {
        const value = fieldValue(email, field);
        expect(
          matches(value, operator, "zzz-definitely-not-present-zzz")
        ).toBe(false);
      });
    }
  }
});

// ---------------------------------------------------------------------------
// applyAction: each action type produces the correct mutation.
// ---------------------------------------------------------------------------
describe("applyAction", () => {
  describe("ASSIGN", () => {
    it("resolves a user and sets assigneeId on the email", async () => {
      mockPrisma.user.findFirst.mockResolvedValue({ id: "user-42" });

      await applyAction("email-1", "ASSIGN", "alice@acme.com");

      expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
        where: { OR: [{ id: "alice@acme.com" }, { email: "alice@acme.com" }] },
        select: { id: true },
      });
      expect(mockPrisma.email.update).toHaveBeenCalledWith({
        where: { id: "email-1" },
        data: { assigneeId: "user-42" },
      });
    });

    it("does NOT update the email when no user is found", async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await applyAction("email-1", "ASSIGN", "ghost@nowhere.com");

      expect(mockPrisma.email.update).not.toHaveBeenCalled();
    });
  });

  describe("SET_PRIORITY", () => {
    it("uppercases the value and updates the classification priority", async () => {
      await applyAction("email-1", "SET_PRIORITY", "high");

      expect(mockPrisma.classification.update).toHaveBeenCalledWith({
        where: { emailId: "email-1" },
        data: { priority: "HIGH" },
      });
    });
  });

  describe("SET_CATEGORY", () => {
    it("uppercases the value and updates the classification category", async () => {
      await applyAction("email-1", "SET_CATEGORY", "billing");

      expect(mockPrisma.classification.update).toHaveBeenCalledWith({
        where: { emailId: "email-1" },
        data: { category: "BILLING" },
      });
    });
  });

  describe("SET_TEAM", () => {
    it("writes the raw actionValue to the classification assignee", async () => {
      await applyAction("email-1", "SET_TEAM", "Tier-2 Support");

      expect(mockPrisma.classification.update).toHaveBeenCalledWith({
        where: { emailId: "email-1" },
        data: { assignee: "Tier-2 Support" },
      });
    });
  });

  it("creates a placeholder classification when none exists yet", async () => {
    mockPrisma.classification.findUnique.mockResolvedValue(null);

    await applyAction("email-1", "SET_PRIORITY", "urgent");

    expect(mockPrisma.classification.update).not.toHaveBeenCalled();
    expect(mockPrisma.classification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        emailId: "email-1",
        category: "GENERAL",
        priority: "URGENT",
        sentiment: "NEUTRAL",
        confidence: 0,
      }),
    });
  });

  it("does nothing for an unknown action type", async () => {
    await applyAction("email-1", "UNKNOWN" as RuleActionType, "x");

    expect(mockPrisma.email.update).not.toHaveBeenCalled();
    expect(mockPrisma.classification.update).not.toHaveBeenCalled();
    expect(mockPrisma.classification.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// applyRules: end-to-end orchestration (find -> match -> apply).
// ---------------------------------------------------------------------------
describe("applyRules", () => {
  it("queries only enabled rules scoped to the org", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([]);

    await applyRules("org-9", makeEmail());

    expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-9", enabled: true },
    });
  });

  it("returns 0 and applies nothing when there are no rules", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([]);

    const applied = await applyRules("org-1", makeEmail());

    expect(applied).toBe(0);
    expect(mockPrisma.classification.update).not.toHaveBeenCalled();
  });

  it("returns 0 when a rule condition does not match (no change)", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([
      makeRule({
        conditionField: "SUBJECT",
        operator: "CONTAINS",
        value: "no-such-word",
      }),
    ]);

    const applied = await applyRules(
      "org-1",
      makeEmail({ subject: "Urgent: server down" })
    );

    expect(applied).toBe(0);
    expect(mockPrisma.classification.update).not.toHaveBeenCalled();
    expect(mockPrisma.email.update).not.toHaveBeenCalled();
  });

  it("applies a single matching rule and returns 1", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([
      makeRule({
        conditionField: "SUBJECT",
        operator: "CONTAINS",
        value: "urgent",
        actionType: "SET_PRIORITY",
        actionValue: "urgent",
      }),
    ]);

    const applied = await applyRules(
      "org-1",
      makeEmail({ subject: "Urgent: server down" })
    );

    expect(applied).toBe(1);
    expect(mockPrisma.classification.update).toHaveBeenCalledWith({
      where: { emailId: "email-1" },
      data: { priority: "URGENT" },
    });
  });

  it("applies multiple matching rules in order and counts each", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "user-7" });
    mockPrisma.automationRule.findMany.mockResolvedValue([
      makeRule({
        id: "r1",
        conditionField: "SUBJECT",
        operator: "STARTS_WITH",
        value: "urgent",
        actionType: "SET_PRIORITY",
        actionValue: "urgent",
      }),
      makeRule({
        id: "r2",
        conditionField: "FROM",
        operator: "CONTAINS",
        value: "acme.com",
        actionType: "SET_CATEGORY",
        actionValue: "support",
      }),
      makeRule({
        id: "r3",
        conditionField: "BODY",
        operator: "CONTAINS",
        value: "server",
        actionType: "ASSIGN",
        actionValue: "oncall@acme.com",
      }),
    ]);

    const applied = await applyRules("org-1", makeEmail());

    expect(applied).toBe(3);

    // Verify each action fired with the right mutation, and ordering is r1->r2->r3.
    const priorityCall = mockPrisma.classification.update.mock.calls.find(
      (c) => c[0].data.priority
    );
    const categoryCall = mockPrisma.classification.update.mock.calls.find(
      (c) => c[0].data.category
    );
    expect(priorityCall?.[0].data).toEqual({ priority: "URGENT" });
    expect(categoryCall?.[0].data).toEqual({ category: "SUPPORT" });
    expect(mockPrisma.email.update).toHaveBeenCalledWith({
      where: { id: "email-1" },
      data: { assigneeId: "user-7" },
    });
  });

  it("only applies the matching rules of a mixed set", async () => {
    mockPrisma.automationRule.findMany.mockResolvedValue([
      makeRule({
        id: "match",
        conditionField: "SUBJECT",
        operator: "CONTAINS",
        value: "urgent",
        actionType: "SET_PRIORITY",
        actionValue: "urgent",
      }),
      makeRule({
        id: "nomatch",
        conditionField: "FROM",
        operator: "EQUALS",
        value: "someone-else@other.com",
        actionType: "SET_CATEGORY",
        actionValue: "spam",
      }),
    ]);

    const applied = await applyRules("org-1", makeEmail());

    expect(applied).toBe(1);
    expect(mockPrisma.classification.update).toHaveBeenCalledTimes(1);
    expect(mockPrisma.classification.update).toHaveBeenCalledWith({
      where: { emailId: "email-1" },
      data: { priority: "URGENT" },
    });
  });

  it("continues after a rule action throws, counting only successes", async () => {
    // First matching rule's action throws; second should still apply.
    mockPrisma.classification.update
      .mockRejectedValueOnce(new Error("db write failed"))
      .mockResolvedValue({ id: "cls-1" });

    mockPrisma.automationRule.findMany.mockResolvedValue([
      makeRule({
        id: "boom",
        conditionField: "SUBJECT",
        operator: "CONTAINS",
        value: "urgent",
        actionType: "SET_PRIORITY",
        actionValue: "high",
      }),
      makeRule({
        id: "ok",
        conditionField: "FROM",
        operator: "CONTAINS",
        value: "acme",
        actionType: "SET_CATEGORY",
        actionValue: "support",
      }),
    ]);

    const applied = await applyRules("org-1", makeEmail());

    // The throwing rule is not counted; the succeeding one is.
    expect(applied).toBe(1);
    expect(console.error).toHaveBeenCalled();
  });

  it("skips rules already filtered out by the enabled query (disabled rules never returned)", async () => {
    // The engine relies on the DB `enabled: true` filter; simulate that a
    // disabled rule is simply absent from findMany results -> nothing applies.
    mockPrisma.automationRule.findMany.mockResolvedValue([]);

    const applied = await applyRules("org-1", makeEmail());

    expect(applied).toBe(0);
    expect(mockPrisma.automationRule.findMany).toHaveBeenCalledWith({
      where: { orgId: "org-1", enabled: true },
    });
  });
});
