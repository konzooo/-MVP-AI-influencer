"use client";

import { useRouter } from "next/navigation";
import { TaskFormInline } from "@/components/automated-tasks/TaskFormInline";
import { useTaskStore } from "@/hooks/use-task-store";
import { Task, TaskEditableFields } from "@/lib/task-types";
import { toast } from "sonner";

export default function NewTaskPage() {
  const router = useRouter();
  const { updateTask } = useTaskStore();

  const handleCreate = (fields: TaskEditableFields) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...fields,
      id: crypto.randomUUID(),
      inspirationItems: [],
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      nextRunAt: null,
      lastRunError: null,
      lastRunResultAt: null,
    };
    updateTask(newTask);
    toast.success(`Task "${newTask.name}" created`);
    router.push(`/automated-tasks/${newTask.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-zinc-100">New Task</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Configure a recurring automated post task.
        </p>
      </div>
      <TaskFormInline
        onSave={handleCreate}
        onCancel={() => router.push("/automated-tasks")}
      />
    </div>
  );
}
