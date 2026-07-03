"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireCurrentUser } from "@/lib/auth";
import { taskStatusSchema } from "@/lib/schemas";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string };

/**
 * Validation for creating a task. Mirrors the Prisma Task model.
 *
 * SECURITY: `orgId` is intentionally NOT part of this schema — it is derived
 * from the authenticated user server-side, never trusted from the client.
 */
const createTaskSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  status: taskStatusSchema.optional(),
  dueAt: z.coerce.date().optional().nullable(),
  emailId: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
});

export type CreateTaskInput = z.input<typeof createTaskSchema>;

function revalidateTaskViews() {
  revalidatePath("/dashboard");
  revalidatePath("/inbox");
}

/**
 * Create a task, optionally linked to an email and/or assignee.
 */
export async function createTask(
  input: CreateTaskInput
): Promise<ActionResult<{ id: string }>> {
  const parsed = createTaskSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  try {
    const user = await requireCurrentUser();
    const { title, status, dueAt, emailId, assigneeId } = parsed.data;

    // A linked email / assignee must belong to the caller's org.
    if (emailId) {
      const email = await prisma.email.findFirst({
        where: { id: emailId, mailbox: { orgId: user.orgId } },
        select: { id: true },
      });
      if (!email) return { ok: false, error: "Email not found" };
    }
    if (assigneeId) {
      const assignee = await prisma.user.findFirst({
        where: { id: assigneeId, orgId: user.orgId },
        select: { id: true },
      });
      if (!assignee) return { ok: false, error: "Assignee not found" };
    }

    const task = await prisma.task.create({
      data: {
        title,
        status: status ?? "OPEN",
        dueAt: dueAt ?? null,
        emailId: emailId ?? null,
        assigneeId: assigneeId ?? null,
        orgId: user.orgId,
      },
    });

    revalidateTaskViews();
    return { ok: true, data: { id: task.id } };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

/**
 * Update a task's status (OPEN | IN_PROGRESS | DONE).
 */
export async function updateTaskStatus(
  taskId: string,
  status: z.infer<typeof taskStatusSchema>
): Promise<ActionResult> {
  if (!taskId) return { ok: false, error: "taskId is required" };

  const parsedStatus = taskStatusSchema.safeParse(status);
  if (!parsedStatus.success) {
    return { ok: false, error: `Invalid status: ${String(status)}` };
  }

  try {
    const user = await requireCurrentUser();

    // Scope the write to the caller's org so another tenant's task id cannot
    // be mutated. updateMany returns count 0 when nothing matched.
    const result = await prisma.task.updateMany({
      where: { id: taskId, orgId: user.orgId },
      data: { status: parsedStatus.data },
    });
    if (result.count === 0) return { ok: false, error: "Task not found" };

    revalidateTaskViews();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: errorMessage(err) };
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return "Unexpected error";
}
