import { describe, expect, it } from "vitest";

import {
  automationRuleCreateSchema,
  automationRuleUpdateSchema,
  CATEGORY_VALUES,
  categorySchema,
  classificationResultSchema,
  classifyEmailInputSchema,
  EMAIL_STATUS_VALUES,
  emailStatusSchema,
  PRIORITY_VALUES,
  prioritySchema,
  ROLE_VALUES,
  roleSchema,
  RULE_ACTION_TYPE_VALUES,
  RULE_FIELD_VALUES,
  RULE_OPERATOR_VALUES,
  ruleActionTypeSchema,
  ruleFieldSchema,
  ruleOperatorSchema,
  SENTIMENT_VALUES,
  sentimentSchema,
  TASK_STATUS_VALUES,
  taskStatusSchema,
} from "@/lib/schemas";

// A minimal valid classification result reused across tests.
const validClassification = {
  category: "SUPPORT" as const,
  priority: "HIGH" as const,
  summary: "Customer cannot log in.",
  suggestedReply: "We are looking into it.",
  sentiment: "NEGATIVE" as const,
  confidence: 0.87,
  assignee: null,
};

describe("enum schemas", () => {
  const cases: Array<[string, ReturnType<typeof categorySchema.safeParse> extends never ? never : any, readonly string[]]> = [
    ["category", categorySchema, CATEGORY_VALUES],
    ["priority", prioritySchema, PRIORITY_VALUES],
    ["sentiment", sentimentSchema, SENTIMENT_VALUES],
    ["role", roleSchema, ROLE_VALUES],
    ["emailStatus", emailStatusSchema, EMAIL_STATUS_VALUES],
    ["taskStatus", taskStatusSchema, TASK_STATUS_VALUES],
    ["ruleField", ruleFieldSchema, RULE_FIELD_VALUES],
    ["ruleOperator", ruleOperatorSchema, RULE_OPERATOR_VALUES],
    ["ruleActionType", ruleActionTypeSchema, RULE_ACTION_TYPE_VALUES],
  ];

  it.each(cases)("%s accepts all its canonical values", (_name, schema, values) => {
    for (const v of values) {
      expect(schema.safeParse(v).success).toBe(true);
    }
  });

  it.each(cases)("%s rejects an unknown value", (_name, schema) => {
    expect(schema.safeParse("NOT_A_REAL_VALUE").success).toBe(false);
  });

  it("enum matching is case-sensitive (lowercase rejected)", () => {
    expect(categorySchema.safeParse("support").success).toBe(false);
    expect(prioritySchema.safeParse("high").success).toBe(false);
  });

  it("rejects non-string enum inputs", () => {
    expect(categorySchema.safeParse(123).success).toBe(false);
    expect(prioritySchema.safeParse(null).success).toBe(false);
    expect(sentimentSchema.safeParse(undefined).success).toBe(false);
  });
});

describe("classificationResultSchema", () => {
  it("accepts a fully valid result", () => {
    const parsed = classificationResultSchema.parse(validClassification);
    expect(parsed.category).toBe("SUPPORT");
    expect(parsed.confidence).toBe(0.87);
    expect(parsed.assignee).toBeNull();
  });

  it("accepts a non-null assignee string", () => {
    const res = classificationResultSchema.safeParse({
      ...validClassification,
      assignee: "alex@inboxai.dev",
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.assignee).toBe("alex@inboxai.dev");
  });

  it("accepts confidence boundary values 0 and 1", () => {
    expect(
      classificationResultSchema.safeParse({ ...validClassification, confidence: 0 })
        .success,
    ).toBe(true);
    expect(
      classificationResultSchema.safeParse({ ...validClassification, confidence: 1 })
        .success,
    ).toBe(true);
  });

  it("rejects confidence out of the 0..1 range", () => {
    expect(
      classificationResultSchema.safeParse({ ...validClassification, confidence: 1.01 })
        .success,
    ).toBe(false);
    expect(
      classificationResultSchema.safeParse({ ...validClassification, confidence: -0.1 })
        .success,
    ).toBe(false);
  });

  it("rejects an empty summary or suggestedReply", () => {
    expect(
      classificationResultSchema.safeParse({ ...validClassification, summary: "" })
        .success,
    ).toBe(false);
    expect(
      classificationResultSchema.safeParse({
        ...validClassification,
        suggestedReply: "",
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid enum member inside the object", () => {
    expect(
      classificationResultSchema.safeParse({ ...validClassification, category: "OTHER" })
        .success,
    ).toBe(false);
  });

  it("rejects missing required keys", () => {
    const { summary, ...withoutSummary } = validClassification;
    void summary;
    expect(classificationResultSchema.safeParse(withoutSummary).success).toBe(false);
  });

  it("is strict — rejects unknown keys", () => {
    const res = classificationResultSchema.safeParse({
      ...validClassification,
      extra: "nope",
    });
    expect(res.success).toBe(false);
  });

  it("rejects a non-null non-string assignee (e.g. number)", () => {
    expect(
      classificationResultSchema.safeParse({ ...validClassification, assignee: 42 })
        .success,
    ).toBe(false);
  });
});

describe("classifyEmailInputSchema", () => {
  it("accepts an empty object (all fields nullish/optional)", () => {
    expect(classifyEmailInputSchema.safeParse({}).success).toBe(true);
  });

  it("accepts null and undefined for the nullish string fields", () => {
    const res = classifyEmailInputSchema.safeParse({
      subject: null,
      fromAddr: undefined,
      fromName: null,
      bodyText: "hello",
      snippet: null,
    });
    expect(res.success).toBe(true);
  });

  it("accepts a knownAssignees string array", () => {
    const res = classifyEmailInputSchema.safeParse({
      subject: "Hi",
      knownAssignees: ["a@x.com", "b@x.com"],
    });
    expect(res.success).toBe(true);
    if (res.success) expect(res.data.knownAssignees).toEqual(["a@x.com", "b@x.com"]);
  });

  it("rejects a non-string knownAssignees entry", () => {
    expect(
      classifyEmailInputSchema.safeParse({ knownAssignees: ["ok", 5] }).success,
    ).toBe(false);
  });

  it("rejects a non-string subject", () => {
    expect(classifyEmailInputSchema.safeParse({ subject: 123 }).success).toBe(false);
  });
});

describe("automationRuleCreateSchema", () => {
  const validRule = {
    name: "Route invoices",
    conditionField: "SUBJECT" as const,
    operator: "CONTAINS" as const,
    value: "invoice",
    actionType: "ASSIGN" as const,
    actionValue: "finance",
  };

  it("accepts a valid rule and defaults enabled to true when omitted", () => {
    const parsed = automationRuleCreateSchema.parse(validRule);
    expect(parsed.enabled).toBe(true);
    expect(parsed.name).toBe("Route invoices");
  });

  it("respects an explicit enabled=false", () => {
    const parsed = automationRuleCreateSchema.parse({ ...validRule, enabled: false });
    expect(parsed.enabled).toBe(false);
  });

  it("rejects an empty name with the custom message", () => {
    const res = automationRuleCreateSchema.safeParse({ ...validRule, name: "" });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0].message).toBe("Name is required");
    }
  });

  it("rejects a name over 120 chars", () => {
    expect(
      automationRuleCreateSchema.safeParse({ ...validRule, name: "a".repeat(121) })
        .success,
    ).toBe(false);
  });

  it("rejects an empty condition value and empty action value", () => {
    expect(
      automationRuleCreateSchema.safeParse({ ...validRule, value: "" }).success,
    ).toBe(false);
    expect(
      automationRuleCreateSchema.safeParse({ ...validRule, actionValue: "" }).success,
    ).toBe(false);
  });

  it("rejects a value/actionValue over 500 chars", () => {
    expect(
      automationRuleCreateSchema.safeParse({ ...validRule, value: "x".repeat(501) })
        .success,
    ).toBe(false);
    expect(
      automationRuleCreateSchema.safeParse({
        ...validRule,
        actionValue: "y".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("rejects an invalid conditionField / operator / actionType enum", () => {
    expect(
      automationRuleCreateSchema.safeParse({ ...validRule, conditionField: "CC" })
        .success,
    ).toBe(false);
    expect(
      automationRuleCreateSchema.safeParse({ ...validRule, operator: "REGEX" }).success,
    ).toBe(false);
    expect(
      automationRuleCreateSchema.safeParse({ ...validRule, actionType: "DELETE" })
        .success,
    ).toBe(false);
  });

  // superRefine(refineActionValue): enum-valued actions must carry an enum member.
  it("accepts SET_PRIORITY with a canonical enum actionValue (case-insensitive)", () => {
    expect(
      automationRuleCreateSchema.safeParse({
        ...validRule,
        actionType: "SET_PRIORITY",
        actionValue: "URGENT",
      }).success,
    ).toBe(true);
    expect(
      automationRuleCreateSchema.safeParse({
        ...validRule,
        actionType: "SET_PRIORITY",
        actionValue: "urgent",
      }).success,
    ).toBe(true);
  });

  it("rejects SET_PRIORITY with a non-enum actionValue and flags the actionValue path", () => {
    const res = automationRuleCreateSchema.safeParse({
      ...validRule,
      actionType: "SET_PRIORITY",
      actionValue: "foo",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes("actionValue"))).toBe(
        true,
      );
    }
  });

  it("accepts SET_CATEGORY with a canonical enum actionValue (case-insensitive)", () => {
    expect(
      automationRuleCreateSchema.safeParse({
        ...validRule,
        actionType: "SET_CATEGORY",
        actionValue: "SUPPORT",
      }).success,
    ).toBe(true);
    expect(
      automationRuleCreateSchema.safeParse({
        ...validRule,
        actionType: "SET_CATEGORY",
        actionValue: "support",
      }).success,
    ).toBe(true);
  });

  it("rejects SET_CATEGORY with a non-enum actionValue and flags the actionValue path", () => {
    const res = automationRuleCreateSchema.safeParse({
      ...validRule,
      actionType: "SET_CATEGORY",
      actionValue: "foo",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes("actionValue"))).toBe(
        true,
      );
    }
  });

  it("still accepts arbitrary non-empty actionValue for ASSIGN and SET_TEAM", () => {
    expect(
      automationRuleCreateSchema.safeParse({
        ...validRule,
        actionType: "ASSIGN",
        actionValue: "agent@acme.com",
      }).success,
    ).toBe(true);
    expect(
      automationRuleCreateSchema.safeParse({
        ...validRule,
        actionType: "SET_TEAM",
        actionValue: "growth-squad",
      }).success,
    ).toBe(true);
  });
});

describe("automationRuleUpdateSchema", () => {
  const validUpdate = {
    id: "rule-1",
    name: "Route invoices",
    conditionField: "FROM" as const,
    operator: "EQUALS" as const,
    value: "a@x.com",
    actionType: "SET_PRIORITY" as const,
    actionValue: "HIGH",
    enabled: true,
  };

  it("accepts a valid update payload", () => {
    expect(automationRuleUpdateSchema.safeParse(validUpdate).success).toBe(true);
  });

  it("requires a non-empty id", () => {
    expect(
      automationRuleUpdateSchema.safeParse({ ...validUpdate, id: "" }).success,
    ).toBe(false);
    const { id, ...withoutId } = validUpdate;
    void id;
    expect(automationRuleUpdateSchema.safeParse(withoutId).success).toBe(false);
  });

  it("requires enabled (no default on the update schema)", () => {
    const { enabled, ...withoutEnabled } = validUpdate;
    void enabled;
    expect(automationRuleUpdateSchema.safeParse(withoutEnabled).success).toBe(false);
  });

  it("rejects a SET_PRIORITY update with a non-enum actionValue but accepts a valid one (case-insensitive)", () => {
    expect(
      automationRuleUpdateSchema.safeParse({
        ...validUpdate,
        actionType: "SET_PRIORITY",
        actionValue: "urgent",
      }).success,
    ).toBe(true);
    const res = automationRuleUpdateSchema.safeParse({
      ...validUpdate,
      actionType: "SET_PRIORITY",
      actionValue: "foo",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues.some((i) => i.path.includes("actionValue"))).toBe(
        true,
      );
    }
  });

  it("rejects a SET_CATEGORY update with a non-enum actionValue", () => {
    expect(
      automationRuleUpdateSchema.safeParse({
        ...validUpdate,
        actionType: "SET_CATEGORY",
        actionValue: "billing",
      }).success,
    ).toBe(true);
    expect(
      automationRuleUpdateSchema.safeParse({
        ...validUpdate,
        actionType: "SET_CATEGORY",
        actionValue: "foo",
      }).success,
    ).toBe(false);
  });
});
