"use client";

import { Task } from "./task-types";
import { createClient } from "./supabase/client";

const TASKS_KEY = "ai-influencer-tasks";

// ─── Local storage helpers ────────────────────────────────────────────────────

function loadTasksLocal(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveTasksLocal(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch {
    console.error("Failed to save tasks to localStorage");
  }
}

// ─── Remote (Supabase) ────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export async function saveTaskRemote(task: Task): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const supabase = createClient();
  await supabase.from("tasks").upsert({
    id: task.id,
    user_id: userId,
    data: task,
    status: task.status,
    created_at: task.createdAt,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteTaskRemote(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const supabase = createClient();
  await supabase.from("tasks").delete().eq("id", id).eq("user_id", userId);
}

export async function loadTasksRemote(): Promise<Task[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select("data")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row.data as Task);
}

// ─── Public API (same signatures as before) ───────────────────────────────────

export function loadTasks(): Task[] {
  return loadTasksLocal();
}

export function saveTasks(tasks: Task[]): void {
  saveTasksLocal(tasks);
}

export function saveTask(task: Task): void {
  const tasks = loadTasksLocal();
  const idx = tasks.findIndex((t) => t.id === task.id);
  const updated = { ...task, updatedAt: new Date().toISOString() };

  if (idx >= 0) {
    tasks[idx] = updated;
  } else {
    tasks.unshift(updated);
  }

  saveTasksLocal(tasks);

  // Async remote save
  saveTaskRemote(updated).catch((err) =>
    console.error("[task-store] Remote save failed:", err)
  );
}

export function deleteTask(id: string): void {
  const tasks = loadTasksLocal().filter((t) => t.id !== id);
  saveTasksLocal(tasks);

  deleteTaskRemote(id).catch((err) =>
    console.error("[task-store] Remote delete failed:", err)
  );
}

export function getTaskById(id: string): Task | undefined {
  return loadTasksLocal().find((t) => t.id === id);
}

export function getActiveTasks(): Task[] {
  return loadTasksLocal().filter((t) => t.status === "running");
}

export function getDueTasks(): Task[] {
  const now = new Date();
  return getActiveTasks().filter(
    (t) => t.nextRunAt && new Date(t.nextRunAt) <= now
  );
}

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
