import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createRule,
  updateRule,
  deleteRule,
  toggleRule,
} from "./rules";
import type {
  AutomationRuleCreateInput,
  AutomationRuleUpdateInput,
} from "@/lib/schemas";

// --- Mock the DB boundary + Next cache revalidation. ------------------------
vi.mock("@/lib/prisma", () => {
  const prisma = {
    automationRule: {
      create: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findFirst: vi.fn(),
    },
  };
  return { prisma, default: prisma };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Auth: rules actions derive orgId from the authenticated user. Return a stable
// user by default; set currentUser = null to exercise the unauthenticated path.
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

import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

const mockPrisma = prisma as unknown as {
  automationRule: {
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    deleteMany: ReturnType<typeof vi.fn>;
    findFirst: ReturnType<typeof vi.fn>;
  };
};

function validCreateInput(
  overrides: Partial<AutomationRuleCreateInput & { orgId: string }> = {}
): AutomationRuleCreateInput & { orgId: string } {
  return {
    name: "Urgent to high priority",
    conditionField: "SUBJECT",
    operator: "CONTAINS",
    value: "urgent",
    actionType: "SET_PRIORITY",
    actionValue: "HIGH",
    enabled: true,
    orgId: "org-1",
    ...overrides,
  };
}

function validUpdateInput(
  overrides: Partial<AutomationRuleUpdateInput> = {}
): AutomationRuleUpdateInput {
  return {
    id: "rule-1",
    name: "Updated rule",
    conditionField: "FROM",
    operator: "EQUALS",
    value: "vip@client.com",
    actionType: "ASSIGN",
    actionValue: "agent@acme.com",
    enabled: false,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = AUTH_USER;
});

// ---------------------------------------------------------------------------
// createRule
// ---------------------------------------------------------------------------
describe("createRule", () => {
  it("validates input and calls prisma.create with mapped data + the authenticated user's orgId", async () => {
    mockPrisma.automationRule.create.mockResolvedValue({ id: "new-rule" });

    const result = await createRule(validCreateInput());

    expect(result).toEqual({ ok: true, data: { id: "new-rule" } });
    expect(mockPrisma.automationRule.create).toHaveBeenCalledWith({
      data: {
        name: "Urgent to high priority",
        conditionField: "SUBJECT",
        operator: "CONTAINS",
        value: "urgent",
        actionType: "SET_PRIORITY",
        actionValue: "HIGH",
        enabled: true,
        orgId: "org-1",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/automation");
  });

  it("derives orgId from the user and IGNORES any orgId in the input (cross-tenant write guard)", async () => {
    mockPrisma.automationRule.create.mockResolvedValue({ id: "new-rule" });

    // A malicious caller tries to plant a rule in another tenant.
    const result = await createRule(validCreateInput({ orgId: "org-attacker" }));

    expect(result).toEqual({ ok: true, data: { id: "new-rule" } });
    expect(mockPrisma.automationRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ orgId: "org-1" }),
      })
    );
  });

  it("returns the UNAUTHENTICATED error and never calls prisma when there is no user", async () => {
    currentUser = null;

    const result = await createRule(validCreateInput());

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(mockPrisma.automationRule.create).not.toHaveBeenCalled();
  });

  it("defaults enabled to true when omitted", async () => {
    mockPrisma.automationRule.create.mockResolvedValue({ id: "r" });
    const input = validCreateInput();
    // Remove enabled to exercise the schema default.
    delete (input as Partial<AutomationRuleCreateInput>).enabled;

    await createRule(input);

    expect(mockPrisma.automationRule.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ enabled: true }),
      })
    );
  });

  it("rejects an empty name with the schema message and never calls prisma", async () => {
    const result = await createRule(validCreateInput({ name: "" }));

    expect(result).toEqual({ ok: false, error: "Name is required" });
    expect(mockPrisma.automationRule.create).not.toHaveBeenCalled();
  });

  it("rejects an invalid conditionField enum value", async () => {
    const result = await createRule(
      validCreateInput({
        conditionField: "ATTACHMENT" as AutomationRuleCreateInput["conditionField"],
      })
    );

    expect(result.ok).toBe(false);
    expect(mockPrisma.automationRule.create).not.toHaveBeenCalled();
  });

  it("rejects an empty condition value", async () => {
    const result = await createRule(validCreateInput({ value: "" }));

    expect(result).toEqual({
      ok: false,
      error: "Condition value is required",
    });
  });

  it("returns an error result (does not throw) when prisma fails in mock mode", async () => {
    mockPrisma.automationRule.create.mockRejectedValue(
      new Error("DATABASE_URL is not configured — running in mock mode.")
    );

    const result = await createRule(validCreateInput());

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("mock mode");
    }
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// updateRule
// ---------------------------------------------------------------------------
describe("updateRule", () => {
  it("validates input and updates by id scoped to the caller's org", async () => {
    mockPrisma.automationRule.updateMany.mockResolvedValue({ count: 1 });

    const result = await updateRule(validUpdateInput());

    expect(result).toEqual({ ok: true });
    // Write is scoped to the caller's org so a foreign rule id cannot be updated.
    expect(mockPrisma.automationRule.updateMany).toHaveBeenCalledWith({
      where: { id: "rule-1", orgId: "org-1" },
      data: {
        name: "Updated rule",
        conditionField: "FROM",
        operator: "EQUALS",
        value: "vip@client.com",
        actionType: "ASSIGN",
        actionValue: "agent@acme.com",
        enabled: false,
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/automation");
  });

  it("returns 'Rule not found' when nothing matched (cross-tenant rule id)", async () => {
    mockPrisma.automationRule.updateMany.mockResolvedValue({ count: 0 });

    const result = await updateRule(validUpdateInput());

    expect(result).toEqual({ ok: false, error: "Rule not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the UNAUTHENTICATED error and never writes when there is no user", async () => {
    currentUser = null;

    const result = await updateRule(validUpdateInput());

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(mockPrisma.automationRule.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an empty id", async () => {
    const result = await updateRule(validUpdateInput({ id: "" }));

    expect(result.ok).toBe(false);
    expect(mockPrisma.automationRule.updateMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid actionType enum", async () => {
    const result = await updateRule(
      validUpdateInput({
        actionType: "DELETE" as AutomationRuleUpdateInput["actionType"],
      })
    );

    expect(result.ok).toBe(false);
    expect(mockPrisma.automationRule.updateMany).not.toHaveBeenCalled();
  });

  it("returns an error result when prisma throws", async () => {
    mockPrisma.automationRule.updateMany.mockRejectedValue(new Error("boom"));

    const result = await updateRule(validUpdateInput());

    expect(result).toEqual({ ok: false, error: "boom" });
  });
});

// ---------------------------------------------------------------------------
// deleteRule
// ---------------------------------------------------------------------------
describe("deleteRule", () => {
  it("deletes by id scoped to the caller's org and revalidates", async () => {
    mockPrisma.automationRule.deleteMany.mockResolvedValue({ count: 1 });

    const result = await deleteRule("rule-1");

    expect(result).toEqual({ ok: true });
    expect(mockPrisma.automationRule.deleteMany).toHaveBeenCalledWith({
      where: { id: "rule-1", orgId: "org-1" },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/automation");
  });

  it("returns 'Rule not found' when nothing matched (cross-tenant rule id)", async () => {
    mockPrisma.automationRule.deleteMany.mockResolvedValue({ count: 0 });

    const result = await deleteRule("rule-1");

    expect(result).toEqual({ ok: false, error: "Rule not found" });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("returns the UNAUTHENTICATED error and never deletes when there is no user", async () => {
    currentUser = null;

    const result = await deleteRule("rule-1");

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(mockPrisma.automationRule.deleteMany).not.toHaveBeenCalled();
  });

  it("rejects a missing id without calling prisma", async () => {
    const result = await deleteRule("");

    expect(result).toEqual({ ok: false, error: "Rule id is required" });
    expect(mockPrisma.automationRule.deleteMany).not.toHaveBeenCalled();
  });

  it("returns an error result when prisma throws", async () => {
    mockPrisma.automationRule.deleteMany.mockRejectedValue(new Error("no row"));

    const result = await deleteRule("rule-1");

    expect(result).toEqual({ ok: false, error: "no row" });
  });
});

// ---------------------------------------------------------------------------
// toggleRule
// ---------------------------------------------------------------------------
describe("toggleRule", () => {
  it("sets the explicit enabled value but STILL reads current state for the org ownership check", async () => {
    mockPrisma.automationRule.findFirst.mockResolvedValue({ enabled: true });
    mockPrisma.automationRule.update.mockResolvedValue({ id: "rule-1" });

    const result = await toggleRule("rule-1", false);

    expect(result).toEqual({ ok: true, data: { enabled: false } });
    // Ownership check is scoped to the caller's org even for an explicit value.
    expect(mockPrisma.automationRule.findFirst).toHaveBeenCalledWith({
      where: { id: "rule-1", orgId: "org-1" },
      select: { enabled: true },
    });
    expect(mockPrisma.automationRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: { enabled: false },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/automation");
  });

  it("flips the current enabled value when omitted", async () => {
    mockPrisma.automationRule.findFirst.mockResolvedValue({ enabled: true });
    mockPrisma.automationRule.update.mockResolvedValue({ id: "rule-1" });

    const result = await toggleRule("rule-1");

    expect(result).toEqual({ ok: true, data: { enabled: false } });
    expect(mockPrisma.automationRule.findFirst).toHaveBeenCalledWith({
      where: { id: "rule-1", orgId: "org-1" },
      select: { enabled: true },
    });
    expect(mockPrisma.automationRule.update).toHaveBeenCalledWith({
      where: { id: "rule-1" },
      data: { enabled: false },
    });
  });

  it("flips false -> true", async () => {
    mockPrisma.automationRule.findFirst.mockResolvedValue({ enabled: false });
    mockPrisma.automationRule.update.mockResolvedValue({ id: "rule-1" });

    const result = await toggleRule("rule-1");

    expect(result).toEqual({ ok: true, data: { enabled: true } });
  });

  it("returns 'Rule not found' when the rule does not exist / is in another tenant (implicit toggle)", async () => {
    mockPrisma.automationRule.findFirst.mockResolvedValue(null);

    const result = await toggleRule("ghost");

    expect(result).toEqual({ ok: false, error: "Rule not found" });
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("returns 'Rule not found' for an explicit toggle on a cross-tenant rule id", async () => {
    mockPrisma.automationRule.findFirst.mockResolvedValue(null);

    const result = await toggleRule("rule-1", true);

    expect(result).toEqual({ ok: false, error: "Rule not found" });
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("returns the UNAUTHENTICATED error and never touches the DB when there is no user", async () => {
    currentUser = null;

    const result = await toggleRule("rule-1", true);

    expect(result).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(mockPrisma.automationRule.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.automationRule.update).not.toHaveBeenCalled();
  });

  it("rejects a missing id", async () => {
    const result = await toggleRule("");

    expect(result).toEqual({ ok: false, error: "Rule id is required" });
    expect(mockPrisma.automationRule.findFirst).not.toHaveBeenCalled();
  });

  it("returns an error result when prisma throws (mock-mode graceful failure)", async () => {
    mockPrisma.automationRule.findFirst.mockResolvedValue({ enabled: false });
    mockPrisma.automationRule.update.mockRejectedValue(
      new Error("DATABASE_URL is not configured — running in mock mode.")
    );

    const result = await toggleRule("rule-1", true);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("mock mode");
    }
  });
});
