"use client";

import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Task } from "@/lib/task-types";
import { updateTasksCache } from "@/lib/task-store";

export function useTaskStore() {
  const rawTasks = useQuery(api.tasks.list);
  const saveMutation = useMutation(api.tasks.save);
  const removeMutation = useMutation(api.tasks.remove);

  // Parse and sort tasks from Convex
  const tasks: Task[] = useMemo(() => {
    if (!rawTasks) return [];
    return rawTasks
      .map((row: { data: string }) => {
        try {
          return JSON.parse(row.data) as Task;
        } catch {
          return null;
        }
      })
      .filter((t: Task | null): t is Task => t !== null)
      .sort(
        (a: Task, b: Task) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  }, [rawTasks]);

  // Keep localStorage cache in sync for lib/ code that reads synchronously
  useEffect(() => {
    if (rawTasks !== undefined) {
      updateTasksCache(tasks);
    }
  }, [tasks, rawTasks]);

  const getTask = useCallback(
    (id: string): Task | undefined => {
      return tasks.find((t) => t.id === id);
    },
    [tasks]
  );

  const updateTask = useCallback(
    (task: Task) => {
      const updated = { ...task, updatedAt: new Date().toISOString() };
      saveMutation({
        taskId: updated.id,
        data: JSON.stringify(updated),
      });
    },
    [saveMutation]
  );

  const deleteTask = useCallback(
    (id: string) => {
      removeMutation({ taskId: id });
    },
    [removeMutation]
  );

  return {
    tasks,
    isLoading: rawTasks === undefined,
    getTask,
    updateTask,
    deleteTask,
  };
}
