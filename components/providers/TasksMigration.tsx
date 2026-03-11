"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Task } from "@/lib/task-types";

const TASKS_LS_KEY = "ai-influencer-tasks";

/**
 * One-time migration: if Convex tasks table is empty but localStorage has tasks,
 * seed Convex from localStorage. Runs silently on app mount.
 */
export function TasksMigration() {
  const rawTasks = useQuery(api.tasks.list);
  const saveMutation = useMutation(api.tasks.save);
  const migrated = useRef(false);

  useEffect(() => {
    if (rawTasks === undefined) return; // Still loading
    if (migrated.current) return;
    migrated.current = true;

    // If Convex already has tasks, skip migration
    if (rawTasks.length > 0) return;

    try {
      const lsRaw = localStorage.getItem(TASKS_LS_KEY);
      if (!lsRaw) return;

      const tasks: Task[] = JSON.parse(lsRaw);
      if (!Array.isArray(tasks) || tasks.length === 0) return;

      console.log(`[TasksMigration] Migrating ${tasks.length} task(s) from localStorage to Convex`);

      for (const task of tasks) {
        saveMutation({
          taskId: task.id,
          data: JSON.stringify(task),
        });
      }

      console.log("[TasksMigration] Migration complete");
    } catch (error) {
      console.error("[TasksMigration] Failed to migrate:", error);
    }
  }, [rawTasks, saveMutation]);

  return null;
}
