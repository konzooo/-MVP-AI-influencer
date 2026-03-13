"use client";

import { use, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus, Play, Pause, RotateCcw, Pencil, Trash2 } from "lucide-react";
import { useTaskStore } from "@/hooks/use-task-store";
import { usePostStore } from "@/hooks/use-post-store";
import { Task, InspirationItem } from "@/lib/task-types";
import { runTask } from "@/lib/task-runner";
import { TaskFormInline } from "@/components/automated-tasks/TaskFormInline";
import { AddItemDialog } from "@/components/automated-tasks/AddItemDialog";
import { InspirationQueue } from "@/components/automated-tasks/InspirationQueue";
import { TaskRunLog } from "@/components/automated-tasks/TaskRunLog";
import { PostViewModal } from "@/components/post-view/PostViewModal";

type RunStatus = "idle" | "running" | "done" | "error";

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function addCadence(date: Date, task: Task): Date {
  const next = new Date(date);
  if (task.cadence.unit === "days") {
    next.setDate(next.getDate() + task.cadence.every);
  } else {
    next.setDate(next.getDate() + task.cadence.every * 7);
  }
  return next;
}

function getSuggestedNextRun(task: Task): Date {
  const now = new Date();

  if (task.nextRunAt) {
    const nextRun = new Date(task.nextRunAt);
    // If nextRunAt is within the next 25 hours, show it as-is
    // Otherwise suggest today at the same time of day (for rescheduling)
    if (nextRun.getTime() - now.getTime() <= 25 * 60 * 60 * 1000) {
      return nextRun;
    }
    // nextRunAt is far in the future — suggest today at that same clock time
    const today = new Date(now);
    today.setHours(nextRun.getHours(), nextRun.getMinutes(), 0, 0);
    if (today <= now) {
      today.setDate(today.getDate() + 1);
    }
    return today;
  }

  if (task.scheduledTime) {
    const next = new Date(now);
    const [hours, minutes] = task.scheduledTime.split(":").map(Number);
    next.setHours(hours, minutes, 0, 0);

    if (next <= now) {
      return addCadence(next, task);
    }

    return next;
  }

  const next = new Date(now);
  next.setMinutes(next.getMinutes() + 15, 0, 0);
  return next;
}

export default function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { getTask, updateTask, deleteTask: removeTask } = useTaskStore();
  const { posts, deletePost } = usePostStore();

  const [isEditing, setIsEditing] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runLog, setRunLog] = useState<string[]>([]);
  const [modalPostId, setModalPostId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const scheduleInputRef = useRef<HTMLInputElement | null>(null);

  const task = getTask(id);

  if (!task) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  const taskPosts = posts.filter((p) => p.taskId === task.id);
  const scheduleDefaultValue = formatDateTimeLocal(getSuggestedNextRun(task));
  const scheduleInputKey = `${task.status}-${task.nextRunAt ?? "none"}-${task.scheduledTime ?? "none"}`;

  // ─── Task CRUD ──────────────────────────────────────────────────────────────

  const handleUpdateTask = (
    fields: Omit<Task, "id" | "createdAt" | "updatedAt" | "lastRunAt" | "nextRunAt" | "inspirationItems">
  ) => {
    const scheduledRun = getScheduledRunDate();
    if (!scheduledRun) return;

    const updated: Task = {
      ...task,
      ...fields,
      scheduledTime: formatDateTimeLocal(scheduledRun).slice(11, 16),
      nextRunAt:
        task.status === "running" ? scheduledRun.toISOString() : task.nextRunAt,
      updatedAt: new Date().toISOString(),
    };
    updateTask(updated);
    setIsEditing(false);
    toast.success("Task updated");
  };

  const handleDeleteTask = () => {
    if (!window.confirm("Are you sure you want to delete this task? This cannot be undone.")) return;
    removeTask(task.id);
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
    updateTask(updated);
  };

  const handleReorderItems = (items: InspirationItem[]) => {
    const updated: Task = { ...task, inspirationItems: items, updatedAt: new Date().toISOString() };
    updateTask(updated);
  };

  const handleDeleteItem = (itemId: string) => {
    const updated: Task = {
      ...task,
      inspirationItems: task.inspirationItems.filter((i) => i.id !== itemId),
      updatedAt: new Date().toISOString(),
    };
    updateTask(updated);
  };

  // ─── Scheduler controls ──────────────────────────────────────────────────────

  const getScheduledRunDate = () => {
    const rawValue = scheduleInputRef.current?.value || scheduleDefaultValue;

    if (!rawValue) {
      toast.error("Choose when the next run should happen");
      return null;
    }

    const scheduledRun = new Date(rawValue);
    if (Number.isNaN(scheduledRun.getTime())) {
      toast.error("Enter a valid schedule time");
      return null;
    }

    // Allow times up to 5 minutes in the past (cron will pick it up immediately)
    if (scheduledRun < new Date(Date.now() - 5 * 60 * 1000)) {
      toast.error("Schedule time is too far in the past");
      return null;
    }

    return scheduledRun;
  };

  const handleStart = () => {
    const scheduledRun = getScheduledRunDate();
    if (!scheduledRun) return;

    const updated: Task = {
      ...task,
      status: "running",
      scheduledTime: formatDateTimeLocal(scheduledRun).slice(11, 16),
      nextRunAt: scheduledRun.toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateTask(updated);
    toast.success(`Scheduler started — first run ${scheduledRun.toLocaleString()}`);
  };

  const handlePause = () => {
    const updated: Task = {
      ...task,
      status: "paused",
      nextRunAt: null,
      updatedAt: new Date().toISOString(),
    };
    updateTask(updated);
    toast.success("Scheduler paused");
  };

  const handleResume = () => {
    const scheduledRun = getScheduledRunDate();
    if (!scheduledRun) return;

    const updated: Task = {
      ...task,
      status: "running",
      scheduledTime: formatDateTimeLocal(scheduledRun).slice(11, 16),
      nextRunAt: scheduledRun.toISOString(),
      updatedAt: new Date().toISOString(),
    };
    updateTask(updated);
    toast.success(`Scheduler resumed — next run ${scheduledRun.toLocaleString()}`);
  };

  const handleRunNow = async (taskSnapshot?: Task) => {
    const t = taskSnapshot ?? task;
    setRunStatus("running");
    setRunLog([]);

    const result = await runTask(t);

    setRunLog(result.log);
    setRunStatus(result.success ? "done" : "error");

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
          <Card className="mb-4 border-zinc-800 bg-zinc-900/50 p-4">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {task.scheduledTime ? "Next Scheduled Run" : "First Scheduled Run"}
              </p>
              <input
                key={scheduleInputKey}
                ref={scheduleInputRef}
                type="datetime-local"
                defaultValue={scheduleDefaultValue}
                className="mt-2 h-9 w-full rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-zinc-100 outline-none transition-[color,box-shadow] focus-visible:border-zinc-500 focus-visible:ring-2 focus-visible:ring-zinc-500/40"
              />
              <p className="mt-2 text-xs text-zinc-500">
                Time is in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone}). Save to lock in the new schedule.
              </p>
            </div>
          </Card>
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
            <div className="mb-4 border-b border-zinc-800 pb-4">
              <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                {task.scheduledTime ? "Next Scheduled Run" : "First Scheduled Run"}
              </p>
              <p className="mt-2 text-lg text-zinc-100">
                {new Date(scheduleDefaultValue).toLocaleString()}
              </p>
              <p className="mt-2 text-xs text-zinc-500">
                Use Edit to change the locked schedule time.
              </p>
            </div>

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
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Run Time</p>
                <p className="mt-1 text-zinc-200">{task.scheduledTime ?? "Not set"}</p>
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
                        <p className="text-sm text-red-300">Delete &quot;{post.title || "untitled"}&quot;?</p>
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
