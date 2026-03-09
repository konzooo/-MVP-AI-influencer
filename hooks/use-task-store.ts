"use client";

import { useCallback } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Task } from "@/lib/task-types";
import { Id } from "@/convex/_generated/dataModel";

/** Convert a Convex task document back to the Task shape used throughout the app. */
function toTask(doc: any): Task & { _id: Id<"tasks"> } {
  return {
    ...doc,
    id: doc.externalId,
  };
}

export function useTaskStore() {
  const rawTasks = useQuery(api.tasks.list) ?? [];
  const rawActiveTasks = useQuery(api.tasks.getActive) ?? [];
  const rawDueTasks = useQuery(api.tasks.getDue) ?? [];
  const saveMutation = useMutation(api.tasks.save);
  const removeByExternalIdMutation = useMutation(api.tasks.removeByExternalId);

  const tasks: (Task & { _id: Id<"tasks"> })[] = rawTasks.map(toTask);
  const activeTasks: Task[] = rawActiveTasks.map(toTask);
  const dueTasks: Task[] = rawDueTasks.map(toTask);

  const getTaskById = useCallback(
    (id: string): Task | undefined => {
      return tasks.find((t) => t.id === id);
    },
    [tasks]
  );

  const updateTask = useCallback(
    async (task: Task) => {
      const { id, ...rest } = task as any;
      const _id = (task as any)._id as Id<"tasks"> | undefined;
      await saveMutation({
        ...rest,
        id: _id,
        externalId: id,
        updatedAt: new Date().toISOString(),
      });
    },
    [saveMutation]
  );

  const deleteTask = useCallback(
    async (id: string) => {
      await removeByExternalIdMutation({ externalId: id });
    },
    [removeByExternalIdMutation]
  );

  return {
    tasks,
    activeTasks,
    dueTasks,
    getTaskById,
    updateTask,
    deleteTask,
  };
}
