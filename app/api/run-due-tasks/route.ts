import { NextResponse } from "next/server";
import { getDueTasks, saveTask, computeNextRunAt } from "@/lib/task-store";

/**
 * POST /api/run-due-tasks
 *
 * External cron endpoint — triggers all tasks whose nextRunAt is in the past.
 * Call this from a cron service (e.g. cron-job.org, Vercel Cron) every minute.
 *
 * Optional header: Authorization: Bearer <CRON_SECRET>
 * Set CRON_SECRET env var to protect the endpoint.
 */
export async function POST(request: Request) {
  // Optional bearer-token auth
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const dueTasks = getDueTasks();

  if (dueTasks.length === 0) {
    return NextResponse.json({ ran: 0, results: [] });
  }

  const results: { taskId: string; taskName: string; success: boolean; error: string | null }[] = [];

  for (const task of dueTasks) {
    try {
      // Dynamically import to avoid edge-runtime issues with localStorage mocks
      const { runTask } = await import("@/lib/task-runner");
      const result = await runTask(task);

      // Update nextRunAt even on failure so we don't retry immediately
      const updated = {
        ...task,
        lastRunAt: new Date().toISOString(),
        nextRunAt: computeNextRunAt(task),
        updatedAt: new Date().toISOString(),
      };
      saveTask(updated);

      results.push({
        taskId: task.id,
        taskName: task.name,
        success: result.success,
        error: result.error,
      });
    } catch (err) {
      results.push({
        taskId: task.id,
        taskName: task.name,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
