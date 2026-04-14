import { Task } from "./task-types";
import { getConvexClient } from "./convex-client";
import { api } from "@/convex/_generated/api";

const TASKS_CACHE_KEY = "ai-influencer-tasks-cache";
const TASKS_LEGACY_KEY = "ai-influencer-tasks";

// ─── localStorage Cache (kept in sync by useTaskStore hook) ─────────────────

/**
 * Update the local cache (called by the React hook when Convex data changes).
 */
export function updateTasksCache(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TASKS_CACHE_KEY, JSON.stringify(tasks));
    localStorage.removeItem(TASKS_LEGACY_KEY);
  } catch {
    // Ignore quota errors for cache
  }
}

/**
 * Synchronous loadTasks — reads from localStorage cache.
 * The useTaskStore hook keeps this cache updated from Convex.
 */
export function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const cached = localStorage.getItem(TASKS_CACHE_KEY);
    if (cached) return JSON.parse(cached) as Task[];
    return [];
  } catch {
    return [];
  }
}

// ─── Async Convex-backed functions (for server-side / API routes) ───────────

/**
 * Load all tasks from Convex (async). For use in API routes.
 */
export async function loadTasksAsync(): Promise<Task[]> {
  try {
    const client = getConvexClient();
    const rows = await client.query(api.tasks.list);
    return rows
      .map((row: { data: string }) => {
        try {
          return JSON.parse(row.data) as Task;
        } catch {
          return null;
        }
      })
      .filter((t: Task | null): t is Task => t !== null);
  } catch (error) {
    console.error("[TaskStore] Failed to load tasks from Convex:", error);
    return [];
  }
}

/**
 * Get due tasks from Convex (async). For use in API routes.
 */
export async function getDueTasksAsync(): Promise<Task[]> {
  const tasks = await loadTasksAsync();
  const now = new Date();

  return tasks.filter(
    (t) => t.status === "running" && t.nextRunAt && new Date(t.nextRunAt) <= now
  );
}

/**
 * Save a task to Convex (async). For use in API routes and task runner.
 */
export async function saveTaskAsync(task: Task): Promise<void> {
  const updated = { ...task, updatedAt: new Date().toISOString() };
  try {
    const client = getConvexClient();
    await client.mutation(api.tasks.save, {
      taskId: updated.id,
      data: JSON.stringify(updated),
    });
  } catch (error) {
    console.error("[TaskStore] Failed to save task to Convex:", error);
  }
}

/**
 * Save a task — fires Convex mutation (fire-and-forget from client, awaited from server).
 */
export function saveTask(task: Task): void {
  const updated = { ...task, updatedAt: new Date().toISOString() };
  try {
    const client = getConvexClient();
    client.mutation(api.tasks.save, {
      taskId: updated.id,
      data: JSON.stringify(updated),
    });
  } catch (error) {
    console.error("[TaskStore] Failed to save task to Convex:", error);
  }
}

/**
 * Delete a task from Convex.
 */
export function deleteTask(id: string): void {
  try {
    const client = getConvexClient();
    client.mutation(api.tasks.remove, { taskId: id });
  } catch (error) {
    console.error("[TaskStore] Failed to delete task from Convex:", error);
  }
}

/**
 * Get a single task by ID (reads from cache).
 */
export function getTaskById(id: string): Task | undefined {
  return loadTasks().find((t) => t.id === id);
}

/**
 * Get all running (scheduled) tasks (reads from cache).
 */
export function getActiveTasks(): Task[] {
  return loadTasks().filter((t) => t.status === "running");
}

/**
 * Get all tasks due for execution (reads from cache).
 */
export function getDueTasks(): Task[] {
  const now = new Date();
  return getActiveTasks().filter(
    (t) => t.nextRunAt && new Date(t.nextRunAt) <= now
  );
}

/**
 * Compute next run time based on task cadence.
 * Always returns the next future slot, so stale tasks do not backfill missed runs.
 */
export function computeNextRunAt(task: Task): string {
  const now = new Date();
  const baseTimestamp = task.nextRunAt ?? task.lastRunAt;
  const next = new Date(baseTimestamp ?? new Date().toISOString());

  if (!baseTimestamp && task.scheduledTime) {
    const [hours, minutes] = task.scheduledTime.split(":").map(Number);
    next.setHours(hours, minutes, 0, 0);
  }

  while (next <= now) {
    if (task.cadence.unit === "days") {
      next.setDate(next.getDate() + task.cadence.every);
    } else {
      next.setDate(next.getDate() + task.cadence.every * 7);
    }
  }

  return next.toISOString();
}

/**
 * Atomically claim a due task run so concurrent cron invocations can't execute it twice.
 * Returns the updated task snapshot when the claim succeeds, or null when another worker
 * already advanced it.
 */
export async function claimTaskRunAsync(
  task: Task,
  timestamps: { lastRunAt: string; nextRunAt: string }
): Promise<Task | null> {
  try {
    const client = getConvexClient();
    const result = await client.mutation(api.tasks.claimRun, {
      taskId: task.id,
      expectedNextRunAt: task.nextRunAt ?? "",
      lastRunAt: timestamps.lastRunAt,
      nextRunAt: timestamps.nextRunAt,
    });

    if (!result.claimed || !result.data) {
      return null;
    }

    return JSON.parse(result.data) as Task;
  } catch (error) {
    console.error("[TaskStore] Failed to claim task run:", error);
    return null;
  }
}
