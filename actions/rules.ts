"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import {
  automationRuleCreateSchema,
  automationRuleUpdateSchema,
  type AutomationRuleCreateInput,
  type AutomationRuleUpdateInput,
} from "@/lib/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

function revalidateRules() {
  revalidatePath("/automation");
}

/**
 * Create a new automation rule for the caller's organization.
 *
 * SECURITY: `orgId` is derived from the authenticated user, never from the
 * client. Any `orgId` present on `input` is accepted for backwards-compat but
 * intentionally ignored so a caller cannot create rules in another tenant.
 */
export async function createRule(
  input: AutomationRuleCreateInput & { orgId?: string }
): Promise<ActionResult<{ id: string }>> {
  const parsed = automationRuleCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  try {
    const user = await requireCurrentUser();

    const rule = await prisma.automationRule.create({
      data: {
        name: parsed.data.name,
        conditionField: parsed.data.conditionField,
        operator: parsed.data.operator,
        value: parsed.data.value,
        actionType: parsed.data.actionType,
        actionValue: parsed.data.actionValue,
        enabled: parsed.data.enabled,
        orgId: user.orgId,
      },
    });

    revalidateRules();
    return { ok: true, data: { id: rule.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Update an existing automation rule. The rule `id` is part of the input.
 */
export async function updateRule(
  input: AutomationRuleUpdateInput
): Promise<ActionResult> {
  const parsed = automationRuleUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const { id, ...fields } = parsed.data;

  try {
    const user = await requireCurrentUser();

    // Scope the write to the caller's org so a rule id from another tenant
    // cannot be updated. updateMany returns count 0 when nothing matched.
    const result = await prisma.automationRule.updateMany({
      where: { id, orgId: user.orgId },
      data: fields,
    });
    if (result.count === 0) return { ok: false, error: "Rule not found" };

    revalidateRules();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Delete an automation rule owned by the caller's org.
 */
export async function deleteRule(id: string): Promise<ActionResult> {
  if (!id) return { ok: false, error: "Rule id is required" };

  try {
    const user = await requireCurrentUser();

    const result = await prisma.automationRule.deleteMany({
      where: { id, orgId: user.orgId },
    });
    if (result.count === 0) return { ok: false, error: "Rule not found" };

    revalidateRules();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Toggle a rule's enabled state. If `enabled` is omitted, flips the current value.
 */
export async function toggleRule(
  id: string,
  enabled?: boolean
): Promise<ActionResult<{ enabled: boolean }>> {
  if (!id) return { ok: false, error: "Rule id is required" };

  try {
    const user = await requireCurrentUser();

    // Read the current state scoped to the caller's org; a miss means the
    // rule either doesn't exist or belongs to another tenant.
    const current = await prisma.automationRule.findFirst({
      where: { id, orgId: user.orgId },
      select: { enabled: true },
    });
    if (!current) return { ok: false, error: "Rule not found" };

    const next = enabled === undefined ? !current.enabled : enabled;

    await prisma.automationRule.update({
      where: { id },
      data: { enabled: next },
    });

    revalidateRules();
    return { ok: true, data: { enabled: next } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

function firstIssue(error: { issues: { message: string }[] }): string {
  return error.issues[0]?.message ?? "Invalid input";
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
