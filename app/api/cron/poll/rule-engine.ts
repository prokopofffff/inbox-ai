import { prisma } from "@/lib/prisma";

/**
 * Pure AutomationRule matching + application engine.
 *
 * Extracted from the cron poll route so the core business logic can be tested
 * in isolation. `applyRules` is the entry point used by the poll pipeline; the
 * smaller helpers (`fieldValue`, `matches`, `applyAction`) are exported so the
 * matrix of field/operator/action combinations can be exercised directly.
 */

export type RuleField = "SUBJECT" | "FROM" | "BODY";
export type RuleOperator = "CONTAINS" | "EQUALS" | "STARTS_WITH";
export type RuleActionType =
  | "ASSIGN"
  | "SET_PRIORITY"
  | "SET_CATEGORY"
  | "SET_TEAM";

/** Minimal shape of a stored email the rule engine reads from. */
export type StoredEmail = {
  id: string;
  fromAddr: string;
  subject: string | null;
  bodyText: string | null;
  snippet: string | null;
};

/** Shape of an AutomationRule row the engine evaluates. */
export type EvaluableRule = {
  id: string;
  conditionField: string;
  operator: string;
  value: string;
  actionType: string;
  actionValue: string;
};

/**
 * Evaluate every enabled rule for an org against a stored email, applying the
 * action of each rule whose condition matches. Rules are evaluated in the order
 * returned by the DB. A single rule action failure is logged and skipped so it
 * does not abort the remaining rules. Returns the count of applied rules.
 */
export async function applyRules(
  orgId: string,
  email: StoredEmail
): Promise<number> {
  const rules = await prisma.automationRule.findMany({
    where: { orgId, enabled: true },
  });
  if (rules.length === 0) return 0;

  let applied = 0;

  for (const rule of rules) {
    const field = fieldValue(email, rule.conditionField as RuleField);
    if (!matches(field, rule.operator as RuleOperator, rule.value)) continue;

    try {
      await applyAction(
        email.id,
        rule.actionType as RuleActionType,
        rule.actionValue
      );
      applied += 1;
    } catch (err) {
      console.error(`[cron/poll] rule ${rule.id} failed:`, err);
    }
  }

  return applied;
}

/** Resolve the string value of the email field a rule condition targets. */
export function fieldValue(email: StoredEmail, field: RuleField): string {
  switch (field) {
    case "SUBJECT":
      return email.subject ?? "";
    case "FROM":
      return email.fromAddr ?? "";
    case "BODY":
      return email.bodyText ?? email.snippet ?? "";
    default:
      return "";
  }
}

/** Case-insensitive comparison of a field value against a rule's target. */
export function matches(
  value: string,
  operator: RuleOperator,
  target: string
): boolean {
  const haystack = value.toLowerCase();
  const needle = target.toLowerCase();
  switch (operator) {
    case "CONTAINS":
      return haystack.includes(needle);
    case "EQUALS":
      return haystack === needle;
    case "STARTS_WITH":
      return haystack.startsWith(needle);
    default:
      return false;
  }
}

/** Perform the side effect of a matched rule against the email's records. */
export async function applyAction(
  emailId: string,
  actionType: RuleActionType,
  actionValue: string
): Promise<void> {
  switch (actionType) {
    case "ASSIGN": {
      // actionValue is a User id or email; resolve to a User id when possible.
      const user = await prisma.user.findFirst({
        where: {
          OR: [{ id: actionValue }, { email: actionValue }],
        },
        select: { id: true },
      });
      if (user) {
        await prisma.email.update({
          where: { id: emailId },
          data: { assigneeId: user.id },
        });
      }
      return;
    }
    case "SET_PRIORITY": {
      await upsertClassificationField(emailId, {
        priority: actionValue.toUpperCase(),
      });
      return;
    }
    case "SET_CATEGORY": {
      await upsertClassificationField(emailId, {
        category: actionValue.toUpperCase(),
      });
      return;
    }
    case "SET_TEAM": {
      // Team routing is stored on the classification's assignee label.
      await upsertClassificationField(emailId, { assignee: actionValue });
      return;
    }
    default:
      return;
  }
}

/**
 * Update a field on the email's Classification, creating a minimal
 * placeholder row if classification has not run yet.
 */
async function upsertClassificationField(
  emailId: string,
  data: Record<string, string>
): Promise<void> {
  const existing = await prisma.classification.findUnique({
    where: { emailId },
    select: { id: true },
  });

  if (existing) {
    await prisma.classification.update({
      where: { emailId },
      data,
    });
    return;
  }

  await prisma.classification.create({
    data: {
      emailId,
      category: "GENERAL",
      priority: "MEDIUM",
      summary: "",
      suggestedReply: "",
      sentiment: "NEUTRAL",
      confidence: 0,
      ...data,
    } as never,
  });
}
