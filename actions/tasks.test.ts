import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mock external boundaries ------------------------------------------------
vi.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    email: {
      findFirst: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
    },
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

// Auth: createTask/updateTaskStatus derive orgId from the authenticated user.
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

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { createTask, updateTaskStatus, type CreateTaskInput } from "./tasks";

const taskCreate = vi.mocked(prisma.task.create);
const taskUpdateMany = vi.mocked(prisma.task.updateMany);
const emailFindFirst = vi.mocked(prisma.email.findFirst);
const userFindFirst = vi.mocked(prisma.user.findFirst);
const revalidate = vi.mocked(revalidatePath);

beforeEach(() => {
  vi.clearAllMocks();
  currentUser = AUTH_USER;
  // Default happy-path ownership for linked email / assignee lookups.
  emailFindFirst.mockResolvedValue({ id: "email-7" } as never);
  userFindFirst.mockResolvedValue({ id: "user-3" } as never);
});

// orgId is no longer part of the input — it is derived from the user.
const validInput: CreateTaskInput = {
  title: "Follow up with customer",
};

// -----------------------------------------------------------------------------
// createTask
// -----------------------------------------------------------------------------
describe("createTask", () => {
  it("creates a task with the user's orgId + defaults and revalidates dashboard + inbox", async () => {
    taskCreate.mockResolvedValue({ id: "task-123" } as never);

    const res = await createTask(validInput);

    expect(res).toEqual({ ok: true, data: { id: "task-123" } });
    // orgId is derived from the authenticated user, never from client input.
    expect(taskCreate).toHaveBeenCalledWith({
      data: {
        title: "Follow up with customer",
        status: "OPEN", // default applied
        dueAt: null,
        emailId: null,
        assigneeId: null,
        orgId: "org-1",
      },
    });
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
    expect(revalidate).toHaveBeenCalledWith("/inbox");
  });

  it("returns the UNAUTHENTICATED error and never creates when there is no user", async () => {
    currentUser = null;

    const res = await createTask(validInput);

    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it("passes through all optional fields and coerces dueAt to a Date", async () => {
    taskCreate.mockResolvedValue({ id: "task-9" } as never);

    const res = await createTask({
      title: "Ship it",
      status: "IN_PROGRESS",
      dueAt: "2026-08-01T00:00:00.000Z",
      emailId: "email-7",
      assigneeId: "user-3",
    });

    expect(res).toEqual({ ok: true, data: { id: "task-9" } });
    // A linked email / assignee is validated against the caller's org.
    expect(emailFindFirst).toHaveBeenCalledWith({
      where: { id: "email-7", mailbox: { orgId: "org-1" } },
      select: { id: true },
    });
    expect(userFindFirst).toHaveBeenCalledWith({
      where: { id: "user-3", orgId: "org-1" },
      select: { id: true },
    });
    const arg = taskCreate.mock.calls[0]![0] as {
      data: { dueAt: Date; status: string; emailId: string; orgId: string };
    };
    expect(arg.data.status).toBe("IN_PROGRESS");
    expect(arg.data.emailId).toBe("email-7");
    expect(arg.data.orgId).toBe("org-1");
    expect(arg.data.dueAt).toBeInstanceOf(Date);
    expect((arg.data.dueAt as Date).toISOString()).toBe(
      "2026-08-01T00:00:00.000Z",
    );
  });

  it("returns 'Email not found' and does NOT create when a linked email is in another tenant", async () => {
    emailFindFirst.mockResolvedValue(null as never);

    const res = await createTask({ title: "x", emailId: "email-foreign" });

    expect(res).toEqual({ ok: false, error: "Email not found" });
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it("returns 'Assignee not found' and does NOT create when a linked assignee is in another tenant", async () => {
    userFindFirst.mockResolvedValue(null as never);

    const res = await createTask({ title: "x", assigneeId: "user-foreign" });

    expect(res).toEqual({ ok: false, error: "Assignee not found" });
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it("rejects an empty title with the zod message and never queries the DB", async () => {
    const res = await createTask({ title: "" });

    expect(res).toEqual({ ok: false, error: "Title is required" });
    expect(taskCreate).not.toHaveBeenCalled();
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("rejects an invalid status enum value", async () => {
    const res = await createTask({
      title: "x",
      status: "NOPE" as never,
    });

    expect(res.ok).toBe(false);
    expect(taskCreate).not.toHaveBeenCalled();
  });

  it("returns a graceful error toast (no throw) when create fails in mock mode", async () => {
    taskCreate.mockRejectedValue(
      new Error("DATABASE_URL is not configured — running in mock mode."),
    );

    const res = await createTask(validInput);

    expect(res).toEqual({
      ok: false,
      error: "DATABASE_URL is not configured — running in mock mode.",
    });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("falls back to a generic message for non-Error throws", async () => {
    taskCreate.mockRejectedValue("kaboom");

    const res = await createTask(validInput);

    expect(res).toEqual({ ok: false, error: "Unexpected error" });
  });
});

// -----------------------------------------------------------------------------
// updateTaskStatus
// -----------------------------------------------------------------------------
describe("updateTaskStatus", () => {
  it("updates status scoped to the caller's org and revalidates on the DB path", async () => {
    taskUpdateMany.mockResolvedValue({ count: 1 } as never);

    const res = await updateTaskStatus("task-1", "DONE");

    expect(res).toEqual({ ok: true });
    // Write is scoped to the caller's org so a foreign task id cannot be mutated.
    expect(taskUpdateMany).toHaveBeenCalledWith({
      where: { id: "task-1", orgId: "org-1" },
      data: { status: "DONE" },
    });
    expect(revalidate).toHaveBeenCalledWith("/dashboard");
    expect(revalidate).toHaveBeenCalledWith("/inbox");
  });

  it("returns 'Task not found' when nothing matched (cross-tenant task id)", async () => {
    taskUpdateMany.mockResolvedValue({ count: 0 } as never);

    const res = await updateTaskStatus("task-1", "DONE");

    expect(res).toEqual({ ok: false, error: "Task not found" });
    expect(revalidate).not.toHaveBeenCalled();
  });

  it("returns the UNAUTHENTICATED error and never writes when there is no user", async () => {
    currentUser = null;

    const res = await updateTaskStatus("task-1", "DONE");

    expect(res).toEqual({ ok: false, error: "UNAUTHENTICATED" });
    expect(taskUpdateMany).not.toHaveBeenCalled();
  });

  it("requires taskId", async () => {
    const res = await updateTaskStatus("", "DONE");

    expect(res).toEqual({ ok: false, error: "taskId is required" });
    expect(taskUpdateMany).not.toHaveBeenCalled();
  });

  it("rejects an invalid status without touching the DB", async () => {
    const res = await updateTaskStatus("task-1", "BOGUS" as never);

    expect(res).toEqual({ ok: false, error: "Invalid status: BOGUS" });
    expect(taskUpdateMany).not.toHaveBeenCalled();
  });

  it("returns error toast (no throw) when the write fails in mock mode", async () => {
    taskUpdateMany.mockRejectedValue(new Error("no db"));

    const res = await updateTaskStatus("task-1", "OPEN");

    expect(res).toEqual({ ok: false, error: "no db" });
    expect(revalidate).not.toHaveBeenCalled();
  });
});
