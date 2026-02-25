"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Zap } from "lucide-react";
import { loadTasks, saveTask, deleteTask } from "@/lib/task-store";
import { Task } from "@/lib/task-types";
import { TaskCard } from "@/components/automated-tasks/TaskCard";

export default function AutomatedTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadTasks();
    setTasks(loaded);
    setIsLoading(false);

    // Check for due tasks on page load
    const dueTasks = loaded.filter(
      (t) => t.status === "active" && t.nextRunAt && new Date(t.nextRunAt) <= new Date()
    );
    if (dueTasks.length > 0) {
      console.log(`[Automated Tasks] Found ${dueTasks.length} due tasks`);
      // Auto-run logic would go here (TBD: defer to later implementation)
    }
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-6xl p-6">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId);

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Automated Tasks</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Create recurring post schedules with manual or automatic approval
          </p>
        </div>
        <Button
          onClick={() => {
            // TODO: open create task dialog
            toast("Create task dialog not yet implemented");
          }}
          className="bg-violet-600 text-white hover:bg-violet-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {selectedTask ? (
        // Detail view
        <div>
          <Button
            variant="ghost"
            onClick={() => setSelectedTaskId(null)}
            className="mb-6 text-zinc-400 hover:text-zinc-200"
          >
            ← Back to Tasks
          </Button>
          <Card className="border-zinc-800 bg-zinc-900/50 p-6">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-zinc-100">{selectedTask.name}</h2>
                <p className="mt-1 text-sm text-zinc-400">{selectedTask.description}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    selectedTask.status === "active"
                      ? "bg-emerald-950 text-emerald-400"
                      : selectedTask.status === "paused"
                        ? "bg-yellow-950 text-yellow-400"
                        : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {selectedTask.status}
                </span>
                <span
                  className={`text-xs font-medium px-2 py-1 rounded ${
                    selectedTask.approvalMode === "manual"
                      ? "bg-violet-950 text-violet-400"
                      : "bg-blue-950 text-blue-400"
                  }`}
                >
                  {selectedTask.approvalMode}
                </span>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-xs font-medium text-zinc-400">Cadence</label>
                <p className="mt-1 text-zinc-200">
                  Every {selectedTask.cadence.every} {selectedTask.cadence.unit}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400">Post Type</label>
                <p className="mt-1 text-zinc-200">{selectedTask.defaultPostType}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400">Last Run</label>
                <p className="mt-1 text-zinc-200">
                  {selectedTask.lastRunAt
                    ? new Date(selectedTask.lastRunAt).toLocaleString()
                    : "Never"}
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-zinc-400">Next Run</label>
                <p className="mt-1 text-zinc-200">
                  {selectedTask.nextRunAt
                    ? new Date(selectedTask.nextRunAt).toLocaleString()
                    : "Not scheduled"}
                </p>
              </div>
            </div>

            <div className="mb-6 grid grid-cols-3 gap-4 border-t border-zinc-800 pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-violet-400">
                  {selectedTask.inspirationItems.length}
                </div>
                <p className="text-xs text-zinc-400">items queued</p>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-emerald-400">
                  {selectedTask.inspirationItems.filter((i) => i.status === "used").length}
                </div>
                <p className="text-xs text-zinc-400">items used</p>
              </div>
              <div className="text-center">
                <Button
                  size="sm"
                  onClick={() => {
                    toast("Run task functionality not yet implemented");
                  }}
                  className="w-full bg-violet-600 text-white hover:bg-violet-700"
                >
                  Run Now
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="mb-3 text-sm font-semibold text-zinc-200">Inspiration Queue</h3>
                <div className="space-y-2">
                  {selectedTask.inspirationItems.length === 0 ? (
                    <p className="text-xs text-zinc-500">No items. Falls back to from_scratch.</p>
                  ) : (
                    selectedTask.inspirationItems.map((item, idx) => (
                      <div key={item.id} className="flex items-center gap-3 rounded bg-zinc-800/50 p-3">
                        <div className="flex-1">
                          <p className="text-sm font-medium text-zinc-200">
                            {idx + 1}. {item.type}
                          </p>
                          {item.notes && (
                            <p className="text-xs text-zinc-500">{item.notes}</p>
                          )}
                        </div>
                        <span
                          className={`text-xs px-2 py-1 rounded ${
                            item.status === "pending"
                              ? "bg-blue-950 text-blue-400"
                              : item.status === "used"
                                ? "bg-green-950 text-green-400"
                                : "bg-yellow-950 text-yellow-400"
                          }`}
                        >
                          {item.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-6 flex gap-2 border-t border-zinc-800 pt-6">
              <Button
                variant="outline"
                onClick={() => {
                  deleteTask(selectedTask.id);
                  setTasks(loadTasks());
                  setSelectedTaskId(null);
                  toast.success("Task deleted");
                }}
                className="border-red-800/50 text-red-400 hover:bg-red-950/20"
              >
                Delete Task
              </Button>
              <Button
                variant="outline"
                onClick={() => setSelectedTaskId(null)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                Close
              </Button>
            </div>
          </Card>
        </div>
      ) : (
        // List view
        <div>
          {tasks.length === 0 ? (
            <Card className="border-zinc-800 bg-zinc-900/50 p-12 text-center">
              <Zap className="mx-auto mb-4 h-12 w-12 text-zinc-600" />
              <h2 className="text-lg font-semibold text-zinc-300">No tasks yet</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Create your first automated task to start recurring posts
              </p>
              <Button
                onClick={() => {
                  toast("Create task dialog not yet implemented");
                }}
                className="mt-4 bg-violet-600 text-white hover:bg-violet-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={() => setSelectedTaskId(task.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
