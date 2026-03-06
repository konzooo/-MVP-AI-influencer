"use client";

import { use, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Play, Pause, RotateCcw, Pencil, Trash2 } from "lucide-react";
import { getTaskById, saveTask, deleteTask } from "@/lib/task-store";
import { loadPosts, deletePost } from "@/lib/store";
import { Task, InspirationItem } from "@/lib/task-types";
import { runTask } from "@/lib/task-runner";
import { dispatchTasksUpdated } from "@/lib/task-events";
import { TaskFormInline } from "@/components/automated-tasks/TaskFormInline";
import { AddItemDialog } from "@/components/automated-tasks/AddItemDialog";
import { InspirationQueue } from "@/components/automated-tasks/InspirationQueue";
import { TaskRunLog } from "@/components/automated-tasks/TaskRunLog";
import { PostViewModal } from "@/components/post-view/PostViewModal";

type RunStatus = "idle" | "running" | "done" | "error";

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [task, setTask] = useState<Task | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runLog, setRunLog] = useState<string[]>([]);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const refresh = () => {
    const t = getTaskById(id);
    if (!t) {
      router.replace("/automated-tasks");
      return;
    }
    setTask(t);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!task) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  const taskPosts = loadPosts().filter((p) => p.taskId === task.id);

  // ─── Task CRUD ──────────────────────────────────────────────────────────────

  const handleUpdateTask = (
    fields: Omit<Task, "id" | "createdAt" | "updatedAt" | "lastRunAt" | "nextRunAt" | "inspirationItems">
  ) => {
    const updated: Task = { ...task, ...fields, updatedAt: new Date().toISOString() };
    saveTask(updated);
    setTask(updated);
    setIsEditing(false);
    dispatchTasksUpdated();
    toast.success("Task updated");
  };

  const handleDeleteTask = () => {
    if (!window.confirm("Are you sure you want to delete this task? This cannot be undone.")) return;
    deleteTask(task.id);
    dispatchTasksUpdated();
    toast.success("Task deleted");
    router.push("/automated-tasks");
  };

  // ─── Inspiration items ───────────────────────────────────────────────────────

  const handleAddItem = (item: InspirationItem) => {
    const updated: Task = {
      ...task,
      inspirationItems: [...task.inspirationItems, item],
      updatedAt: new Date().toISOString(),
    };
    saveTask(updated);
    setTask(updated);
  };

  const handleReorderItems = (items: InspirationItem[]) => {
    const updated: Task = { ...task, inspirationItems: items, updatedAt: new Date().toISOString() };
    saveTask(updated);
    setTask(updated);
  };

  const handleDeleteItem = (itemId: string) => {
    const updated: Task = {
      ...task,
      inspirationItems: task.inspirationItems.filter((i) => i.id !== itemId),
      updatedAt: new Date().toISOString(),
    };
    saveTask(updated);
    setTask(updated);
  };

  // ─── Scheduler controls ──────────────────────────────────────────────────────

  const handleStart = () => {
    const now = new Date();
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const scheduledTime = `${hh}:${mm}`;

    // Compute first nextRunAt: now + cadence at today's time
    const firstNext = new Date(now);
    if (task.cadence.unit === "days") {
      firstNext.setDate(firstNext.getDate() + task.cadence.every);
    } else {
      firstNext.setDate(firstNext.getDate() + task.cadence.every * 7);
    }
    firstNext.setHours(now.getHours(), now.getMinutes(), 0, 0);

    const updated: Task = {
      ...task,
      status: "running",
      scheduledTime,
      nextRunAt: firstNext.toISOString(),
      updatedAt: now.toISOString(),
    };
    saveTask(updated);
    setTask(updated);
    dispatchTasksUpdated();
    toast.success(`Scheduler started — runs every ${task.cadence.every} ${task.cadence.unit} at ${scheduledTime}`);

    // Run the first generation immediately
    handleRunNow(updated);
  };

  const handlePause = () => {
    const updated: Task = {
      ...task,
      status: "paused",
      nextRunAt: null,
      updatedAt: new Date().toISOString(),
    };
    saveTask(updated);
    setTask(updated);
    dispatchTasksUpdated();
    toast.success("Scheduler paused");
  };

  const handleResume = () => {
    // Next run = now + cadence at the original scheduledTime
    const now = new Date();
    const next = new Date(now);
    if (task.cadence.unit === "days") {
      next.setDate(next.getDate() + task.cadence.every);
    } else {
      next.setDate(next.getDate() + task.cadence.every * 7);
    }
    if (task.scheduledTime) {
      const [h, m] = task.scheduledTime.split(":").map(Number);
      next.setHours(h, m, 0, 0);
    }

    const updated: Task = {
      ...task,
      status: "running",
      nextRunAt: next.toISOString(),
      updatedAt: now.toISOString(),
    };
    saveTask(updated);
    setTask(updated);
    dispatchTasksUpdated();
    toast.success(`Scheduler resumed — next run ${next.toLocaleString()}`);
  };

  const handleRunNow = async (taskSnapshot?: Task) => {
    const t = taskSnapshot ?? task;
    setRunStatus("running");
    setRunLog([]);

    const result = await runTask(t);

    setRunLog(result.log);
    setRunStatus(result.success ? "done" : "error");
    refresh();
    dispatchTasksUpdated();

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

  const handleDeletePost = (postId: string) => {
    deletePost(postId);
    setDeleteConfirmId(null);
    refresh();
    toast.success("Post deleted");
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl p-6">
      {isEditing ? (
        /* ── Edit mode ─────────────────────────────────────────────── */
        <div>
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-zinc-100">Edit Task</h2>
            <p className="mt-1 text-sm text-zinc-500">Update task settings.</p>
          </div>
          <TaskFormInline
            initialTask={task}
            onSave={handleUpdateTask}
            onCancel={() => setIsEditing(false)}
          />
        </div>
      ) : (
        /* ── View mode ─────────────────────────────────────────────── */
        <div className="space-y-4">
          {/* Top bar */}
          <div className="flex items-center gap-3">
            <h2 className="flex-1 text-xl font-bold text-zinc-100">{task.name}</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Edit
            </Button>

            {/* Scheduler: Start / Pause / Resume */}
            {task.status === "running" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={handlePause}
                className="border-yellow-700 text-yellow-400 hover:bg-yellow-950/30"
              >
                <Pause className="mr-1.5 h-3.5 w-3.5" />
                Pause
              </Button>
            ) : task.scheduledTime ? (
              <Button
                size="sm"
                onClick={handleResume}
                className="bg-emerald-700 text-white hover:bg-emerald-600"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                Resume
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={handleStart}
                disabled={runStatus === "running"}
                className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {runStatus === "running" ? (
                  "Running..."
                ) : (
                  <>
                    <Play className="mr-1.5 h-3.5 w-3.5" />
                    Start
                  </>
                )}
              </Button>
            )}

            {/* Run Now: always available (manual trigger) */}
            {task.status === "running" && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRunNow()}
                disabled={runStatus === "running"}
                className="border-zinc-700 text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
              >
                {runStatus === "running" ? "Running..." : "Run Now"}
              </Button>
            )}
          </div>

          {/* Settings summary */}
          <Card className="border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex flex-wrap gap-6 text-sm">
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Status</p>
                <span
                  className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    task.status === "running"
                      ? "bg-emerald-950 text-emerald-400"
                      : task.status === "paused"
                        ? "bg-yellow-950 text-yellow-400"
                        : "bg-zinc-800 text-zinc-400"
                  }`}
                >
                  {task.status}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Approval</p>
                <span
                  className={`mt-1 inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    task.approvalMode === "manual"
                      ? "bg-violet-950 text-violet-400"
                      : "bg-blue-950 text-blue-400"
                  }`}
                >
                  {task.approvalMode}
                </span>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Cadence</p>
                <p className="mt-1 text-zinc-200">
                  Every {task.cadence.every} {task.cadence.unit}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Post Type</p>
                <p className="mt-1 text-zinc-200">{task.defaultPostType}</p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Last Run</p>
                <p className="mt-1 text-zinc-200">
                  {task.lastRunAt
                    ? new Date(task.lastRunAt).toLocaleString()
                    : "Never"}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Next Run</p>
                <p className="mt-1 text-zinc-200">
                  {task.nextRunAt
                    ? new Date(task.nextRunAt).toLocaleString()
                    : "\u2014"}
                </p>
              </div>
            </div>
            {task.description && (
              <p className="mt-3 border-t border-zinc-800 pt-3 text-sm text-zinc-400">
                {task.description}
              </p>
            )}

            {/* Fallback locations */}
            {task.fallbackLocations && task.fallbackLocations.length > 0 && (
              <div className="mt-3 border-t border-zinc-800 pt-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-2">
                  Fallback Locations
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {task.fallbackLocations.map((fl) => {
                    const totalWeight = task.fallbackLocations.reduce((sum, l) => sum + l.weight, 0);
                    const pct = totalWeight > 0 ? Math.round((fl.weight / totalWeight) * 100) : 0;
                    return (
                      <span
                        key={fl.location}
                        className="rounded bg-zinc-800 px-2 py-0.5 text-[11px] text-zinc-300"
                      >
                        {fl.location} <span className="text-zinc-500">{pct}%</span>
                      </span>
                    );
                  })}
                </div>
              </div>
            )}
            {task.fallbackNotes && (
              <div className="mt-2">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">
                  Fallback Notes
                </p>
                <p className="text-xs text-zinc-400">{task.fallbackNotes}</p>
              </div>
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
                  Own images &amp; example posts · consumed in order · falls back to AI-generated when empty
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
              items={task.inspirationItems}
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
                  <div key={post.id} className="group relative">
                    {deleteConfirmId === post.id ? (
                      /* ── Inline delete confirmation ── */
                      <div className="flex items-center justify-between rounded border border-red-800/50 bg-red-950/20 px-3 py-2">
                        <p className="text-sm text-red-300">Delete "{post.title || "untitled"}"?</p>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleDeletePost(post.id)}
                            className="rounded bg-red-700 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-red-600 transition-colors"
                          >
                            Delete
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="rounded bg-zinc-700 px-2.5 py-1 text-[11px] font-medium text-zinc-300 hover:bg-zinc-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* ── Normal row ── */
                      <div
                        onClick={() => setModalPostId(post.id)}
                        className="flex cursor-pointer items-center justify-between rounded bg-zinc-800/50 px-3 py-2 transition-colors hover:bg-zinc-800"
                      >
                        <div>
                          <p className="text-sm text-zinc-200">{post.title || "(untitled)"}</p>
                          <p className="text-[11px] text-zinc-500">
                            {post.status} · {new Date(post.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
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
                          <button
                            onClick={(e) => { e.stopPropagation(); setDeleteConfirmId(post.id); }}
                            className="rounded p-1 text-zinc-600 opacity-0 group-hover:opacity-100 hover:bg-red-950/40 hover:text-red-400 transition-all"
                            title="Delete post"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
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
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Delete Task
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <AddItemDialog
        open={showAddItem}
        onOpenChange={setShowAddItem}
        defaultPostType={task.defaultPostType}
        onAdd={handleAddItem}
      />

      <PostViewModal
        postId={modalPostId}
        task={task}
        open={!!modalPostId}
        onOpenChange={(open) => { if (!open) setModalPostId(null); }}
        onDelete={(postId) => { handleDeletePost(postId); setModalPostId(null); }}
      />
    </div>
  );
}
