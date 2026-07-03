import { z } from "zod";

/**
 * Canonical enum values.
 *
 * These mirror the Prisma enums exactly. They are declared here (rather than
 * imported from `@prisma/client`) so that client bundles, forms, and the AI
 * layer can validate/serialize without depending on the generated Prisma
 * client. Keep these in sync with `prisma/schema.prisma`.
 */
export const CATEGORY_VALUES = [
  "SUPPORT",
  "SALES",
  "BILLING",
  "SPAM",
  "GENERAL",
  "INTERNAL",
] as const;

export const PRIORITY_VALUES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const SENTIMENT_VALUES = ["POSITIVE", "NEUTRAL", "NEGATIVE"] as const;

export const ROLE_VALUES = ["OWNER", "ADMIN", "MEMBER"] as const;

export const EMAIL_STATUS_VALUES = ["UNREAD", "READ", "ARCHIVED"] as const;

export const TASK_STATUS_VALUES = ["OPEN", "IN_PROGRESS", "DONE"] as const;

export const RULE_FIELD_VALUES = ["SUBJECT", "FROM", "BODY"] as const;

export const RULE_OPERATOR_VALUES = [
  "CONTAINS",
  "EQUALS",
  "STARTS_WITH",
] as const;

export const RULE_ACTION_TYPE_VALUES = [
  "ASSIGN",
  "SET_PRIORITY",
  "SET_CATEGORY",
  "SET_TEAM",
] as const;

// Zod enum schemas -----------------------------------------------------------

export const categorySchema = z.enum(CATEGORY_VALUES);
export const prioritySchema = z.enum(PRIORITY_VALUES);
export const sentimentSchema = z.enum(SENTIMENT_VALUES);
export const roleSchema = z.enum(ROLE_VALUES);
export const emailStatusSchema = z.enum(EMAIL_STATUS_VALUES);
export const taskStatusSchema = z.enum(TASK_STATUS_VALUES);
export const ruleFieldSchema = z.enum(RULE_FIELD_VALUES);
export const ruleOperatorSchema = z.enum(RULE_OPERATOR_VALUES);
export const ruleActionTypeSchema = z.enum(RULE_ACTION_TYPE_VALUES);

export type Category = z.infer<typeof categorySchema>;
export type Priority = z.infer<typeof prioritySchema>;
export type Sentiment = z.infer<typeof sentimentSchema>;
export type Role = z.infer<typeof roleSchema>;
export type EmailStatus = z.infer<typeof emailStatusSchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type RuleField = z.infer<typeof ruleFieldSchema>;
export type RuleOperator = z.infer<typeof ruleOperatorSchema>;
export type RuleActionType = z.infer<typeof ruleActionTypeSchema>;

// ---------------------------------------------------------------------------
// Classification AI output
// ---------------------------------------------------------------------------

/**
 * The exact structured JSON shape the OpenAI classifier must return.
 *
 * NOTE: kept "strict" (no unknown keys) and fully required so it can be used
 * directly as an OpenAI structured-output response format. `assignee` is
 * nullable — the model returns `null` when it cannot confidently pick one.
 */
export const classificationResultSchema = z
  .object({
    category: categorySchema,
    priority: prioritySchema,
    summary: z.string().min(1),
    suggestedReply: z.string().min(1),
    sentiment: sentimentSchema,
    confidence: z.number().min(0).max(1),
    assignee: z.string().nullable(),
  })
  .strict();

export type ClassificationResult = z.infer<typeof classificationResultSchema>;

/** Input given to the classifier / reply streamer. */
export const classifyEmailInputSchema = z.object({
  subject: z.string().nullish(),
  fromAddr: z.string().nullish(),
  fromName: z.string().nullish(),
  bodyText: z.string().nullish(),
  snippet: z.string().nullish(),
  /** Optional roster the model may pick an assignee from. */
  knownAssignees: z.array(z.string()).optional(),
});

export type ClassifyEmailInput = z.infer<typeof classifyEmailInputSchema>;

// ---------------------------------------------------------------------------
// AutomationRule form schemas
// ---------------------------------------------------------------------------

/** Shared field definitions for automation-rule forms. */
const automationRuleBase = z.object({
  name: z.string().min(1, "Name is required").max(120),
  conditionField: ruleFieldSchema,
  operator: ruleOperatorSchema,
  value: z.string().min(1, "Condition value is required").max(500),
  actionType: ruleActionTypeSchema,
  actionValue: z.string().min(1, "Action value is required").max(500),
  enabled: z.boolean(),
});

/**
 * Cross-field check: for enum-valued actions the `actionValue` must be a member
 * of the target enum. Without this, an out-of-enum value (e.g. "foo") passes
 * the string check at creation and later throws when the rule engine writes it
 * into the Priority/Category column — where it is swallowed and the rule
 * silently no-ops forever.
 */
function refineActionValue(
  data: { actionType: RuleActionType; actionValue: string },
  ctx: z.RefinementCtx
): void {
  const upper = data.actionValue.toUpperCase();
  if (
    data.actionType === "SET_PRIORITY" &&
    !(PRIORITY_VALUES as readonly string[]).includes(upper)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["actionValue"],
      message: `Priority must be one of: ${PRIORITY_VALUES.join(", ")}`,
    });
  }
  if (
    data.actionType === "SET_CATEGORY" &&
    !(CATEGORY_VALUES as readonly string[]).includes(upper)
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["actionValue"],
      message: `Category must be one of: ${CATEGORY_VALUES.join(", ")}`,
    });
  }
}

/** Create form: `enabled` defaults to true when omitted. */
export const automationRuleCreateSchema = automationRuleBase
  .extend({
    enabled: z.boolean().default(true),
  })
  .superRefine(refineActionValue);

/** Update form: same fields plus the target rule id. */
export const automationRuleUpdateSchema = automationRuleBase
  .extend({
    id: z.string().min(1),
  })
  .superRefine(refineActionValue);

export type AutomationRuleCreateInput = z.infer<
  typeof automationRuleCreateSchema
>;
export type AutomationRuleUpdateInput = z.infer<
  typeof automationRuleUpdateSchema
>;
