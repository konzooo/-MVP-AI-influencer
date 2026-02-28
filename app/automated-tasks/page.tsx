"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadTasks } from "@/lib/task-store";
import { Task } from "@/lib/task-types";
import { TASKS_UPDATED_EVENT } from "@/lib/task-events";
import { TaskCard } from "@/components/automated-tasks/TaskCard";

export default function AutomatedTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);

  useEffect(() => {
    setTasks(loadTasks());
    const handler = () => setTasks(loadTasks());
    window.addEventListener(TASKS_UPDATED_EVENT, handler);
    return () => window.removeEventListener(TASKS_UPDATED_EVENT, handler);
  }, []);

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold text-zinc-100">Automated Tasks</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Recurring post creation — manual or fully automatic.
          </p>
        </div>
        <Button asChild className="bg-violet-600 text-white hover:bg-violet-700">
          <Link href="/automated-tasks/new">
            <Plus className="mr-2 h-4 w-4" />
            New Task
          </Link>
        </Button>
      </div>

      {tasks.length === 0 ? (
        <Card className="border-zinc-800 bg-zinc-900/50 p-12 text-center">
          <Zap className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
          <h2 className="text-lg font-semibold text-zinc-300">No tasks yet</h2>
          <p className="mt-2 text-sm text-zinc-500">
            Create a task to start automating recurring posts.
          </p>
          <Button asChild className="mt-4 bg-violet-600 text-white hover:bg-violet-700">
            <Link href="/automated-tasks/new">
              <Plus className="mr-2 h-4 w-4" />
              Create Task
            </Link>
          </Button>
        </Card>
      ) : (
        <div className="grid gap-3">
          {tasks.map((task) => (
            <Link key={task.id} href={`/automated-tasks/${task.id}`}>
              <TaskCard task={task} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
