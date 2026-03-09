import { Task } from "./task-types";

/**
 * Pure function to compute the next scheduled run time for a task.
 * Extracted from task-store.ts so it can be used in both client and Convex server code.
 */
export function computeNextRunAt(task: Task): string {
  const base = task.lastRunAt ? new Date(task.lastRunAt) : new Date();
  const next = new Date(base);

  if (task.cadence.unit === "days") {
    next.setDate(next.getDate() + task.cadence.every);
  } else {
    next.setDate(next.getDate() + task.cadence.every * 7);
  }

  if (task.scheduledTime) {
    const [hours, minutes] = task.scheduledTime.split(":").map(Number);
    next.setHours(hours, minutes, 0, 0);
  }

  return next.toISOString();
}
