"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Zap, Play, Pencil } from "lucide-react";
import { loadTasks, saveTask, deleteTask } from "@/lib/task-store";
import { Task, InspirationItem } from "@/lib/task-types";
import { loadPosts } from "@/lib/store";
import { runTask } from "@/lib/task-runner";
import { TaskCard } from "@/components/automated-tasks/TaskCard";
import { TaskForm } from "@/components/automated-tasks/TaskForm";
import { AddItemDialog } from "@/components/automated-tasks/AddItemDialog";
import { InspirationQueue } from "@/components/automated-tasks/InspirationQueue";
import { TaskRunLog } from "@/components/automated-tasks/TaskRunLog";

type RunStatus = "idle" | "running" | "done" | "error";

export default function AutomatedTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Dialogs
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);

  // Run state
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runLog, setRunLog] = useState<string[]>([]);

  const refresh = () => setTasks(loadTasks());

  useEffect(() => {
    refresh();
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;
  const taskPosts = selectedTask
    ? loadPosts().filter((p) => p.taskId === selectedTask.id)
    : [];

  // ─── Task CRUD ──────────────────────────────────────────────────────────────

  const handleCreateTask = (
    fields: Omit<Task, "id" | "createdAt" | "updatedAt" | "lastRunAt" | "nextRunAt" | "inspirationItems">
  ) => {
    const now = new Date().toISOString();
    const newTask: Task = {
      ...fields,
      id: crypto.randomUUID(),
      inspirationItems: [],
      createdAt: now,
      updatedAt: now,
      lastRunAt: null,
      nextRunAt: null,
    };
    saveTask(newTask);
    refresh();
    setSelectedTaskId(newTask.id);
    toast.success(`Task "${newTask.name}" created`);
  };

  const handleUpdateTask = (
    fields: Omit<Task, "id" | "createdAt" | "updatedAt" | "lastRunAt" | "nextRunAt" | "inspirationItems">
  ) => {
    if (!selectedTask) return;
    const updated: Task = { ...selectedTask, ...fields };
    saveTask(updated);
    refresh();
    toast.success("Task updated");
  };

  const handleDeleteTask = () => {
    if (!selectedTask) return;
    deleteTask(selectedTask.id);
    refresh();
    setSelectedTaskId(null);
    toast.success("Task deleted");
  };

  // ─── Inspiration items ───────────────────────────────────────────────────────

  const handleAddItem = (item: InspirationItem) => {
    if (!selectedTask) return;
    const updated: Task = {
      ...selectedTask,
      inspirationItems: [...selectedTask.inspirationItems, item],
    };
    saveTask(updated);
    refresh();
  };

  const handleReorderItems = (items: InspirationItem[]) => {
    if (!selectedTask) return;
    saveTask({ ...selectedTask, inspirationItems: items });
    refresh();
  };

  const handleDeleteItem = (id: string) => {
    if (!selectedTask) return;
    const updated: Task = {
      ...selectedTask,
      inspirationItems: selectedTask.inspirationItems.filter((i) => i.id !== id),
    };
    saveTask(updated);
    refresh();
  };

  // ─── Run Now ────────────────────────────────────────────────────────────────

  const handleRunNow = async () => {
    if (!selectedTask) return;
    setRunStatus("running");
    setRunLog([]);

    const result = await runTask(selectedTask);

    setRunLog(result.log);
    setRunStatus(result.success ? "done" : "error");
    refresh();

    if (result.success) {
      toast.success(
        result.wasFallback
          ? "Task ran — used from-scratch fallback (queue empty)"
          : "Task ran successfully"
      );
    } else {
      toast.error(`Task failed: ${result.error}`);
    }
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Automated Tasks</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Recurring post creation — manual or fully automatic
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="bg-violet-600 text-white hover:bg-violet-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Task
        </Button>
      </div>

      {selectedTask ? (
        /* ── Detail view ─────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Top bar */}
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedTaskId(null);
                setRunStatus("idle");
                setRunLog([]);
              }}
              className="text-zinc-400 hover:text-zinc-200"
            >
              ← Back
            </Button>
            <h2 className="flex-1 text-xl font-bold text-zinc-100">{selectedTask.name}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowEditForm(true)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              size="sm"
              onClick={handleRunNow}
              disabled={runStatus === "running"}
              className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {runStatus === "running" ? (
                "Running..."
              ) : (
                <>
                  <Play className="mr-1.5 h-3.5 w-3.5" />
                  Run Now
                </>
              )}
            </Button>
          </div>

          {/* Settings summary */}
          <Card className="border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Status</p>
                <span
                  className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    selectedTask.status === "active"
                      ? "bg-emerald-950 text-emerald-400"
                      : selectedTask.status === "paused"
                        ? "bg-yellow-950 text-yellow-400"
                        : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {selectedTask.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Approval</p>
                <span
                  className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    selectedTask.approvalMode === "manual"
                      ? "bg-violet-950 text-violet-400"
                      : "bg-blue-950 text-blue-400"
                  }`}
                >
                  {selectedTask.approvalMode}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Cadence</p>
                <p className="mt-1 text-zinc-200">
                  Every {selectedTask.cadence.every} {selectedTask.cadence.unit}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Post Type</p>
                <p className="mt-1 text-zinc-200">{selectedTask.defaultPostType}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Last Run</p>
                <p className="mt-1 text-zinc-200">
                  {selectedTask.lastRunAt
                    ? new Date(selectedTask.lastRunAt).toLocaleString()
                    : "Never"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Next Run</p>
                <p className="mt-1 text-zinc-200">
                  {selectedTask.nextRunAt
                    ? new Date(selectedTask.nextRunAt).toLocaleString()
                    : "—"}
                </p>
              </div>
            </div>
            {selectedTask.description && (
              <p className="mt-3 border-t border-zinc-800 pt-3 text-sm text-zinc-400">
                {selectedTask.description}
              </p>
            )}
          </Card>

          {/* Run log */}
          <TaskRunLog log={runLog} status={runStatus} />

          {/* Inspiration Queue */}
          <Card className="border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Inspiration Queue</h3>
                <p className="text-[11px] text-zinc-500">
                  Consumed in order · falls back to from-scratch when empty
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowAddItem(true)}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Item
              </Button>
            </div>
            <InspirationQueue
              items={selectedTask.inspirationItems}
              onReorder={handleReorderItems}
              onDelete={handleDeleteItem}
            />
          </Card>

          {/* Posts created by this task */}
          {taskPosts.length > 0 && (
            <Card className="border-zinc-800 bg-zinc-900/50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-zinc-100">
                Posts Created ({taskPosts.length})
              </h3>
              <div className="space-y-2">
                {taskPosts.map((post) => (
                  <div
                    key={post.id}
                    className="flex items-center justify-between rounded bg-zinc-800/50 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm text-zinc-200">{post.title || "(untitled)"}</p>
                      <p className="text-[11px] text-zinc-500">
                        {post.status} · {new Date(post.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] rounded px-2 py-0.5 font-medium ${
                        post.status === "posted"
                          ? "bg-emerald-950 text-emerald-400"
                          : post.status === "ready"
                            ? "bg-blue-950 text-blue-400"
                            : post.status === "draft"
                              ? "bg-zinc-700 text-zinc-300"
                              : "bg-zinc-800 text-zinc-400"
                      }`}
                    >
                      {post.status}
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Danger zone */}
          <div className="flex justify-end pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeleteTask}
              className="border-red-800/50 text-red-400 hover:bg-red-950/20"
            >
              Delete Task
            </Button>
          </div>
        </div>
      ) : (
        /* ── List view ──────────────────────────────────────────────── */
        <div>
          {tasks.length === 0 ? (
            <Card className="border-zinc-800 bg-zinc-900/50 p-12 text-center">
              <Zap className="mx-auto mb-4 h-12 w-12 text-zinc-700" />
              <h2 className="text-lg font-semibold text-zinc-300">No tasks yet</h2>
              <p className="mt-2 text-sm text-zinc-500">
                Create a task to start automating recurring posts
              </p>
              <Button
                onClick={() => setShowCreateForm(true)}
                className="mt-4 bg-violet-600 text-white hover:bg-violet-700"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Task
              </Button>
            </Card>
          ) : (
            <div className="grid gap-3">
              {tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onSelect={() => {
                    setSelectedTaskId(task.id);
                    setRunStatus("idle");
                    setRunLog([]);
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Dialogs */}
      <TaskForm
        open={showCreateForm}
        onOpenChange={setShowCreateForm}
        onSave={handleCreateTask}
      />
      {selectedTask && (
        <>
          <TaskForm
            open={showEditForm}
            onOpenChange={setShowEditForm}
            initialTask={selectedTask}
            onSave={handleUpdateTask}
          />
          <AddItemDialog
            open={showAddItem}
            onOpenChange={setShowAddItem}
            defaultPostType={selectedTask.defaultPostType}
            onAdd={handleAddItem}
          />
        </>
      )}
    </div>
  );
}
