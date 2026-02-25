"use client";

import { Task } from "./task-types";

const TASKS_KEY = "ai-influencer-tasks";

/**
 * Load all tasks from localStorage
 */
export function loadTasks(): Task[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error("Failed to load tasks:", error);
    return [];
  }
}

/**
 * Save all tasks to localStorage
 */
export function saveTasks(tasks: Task[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
  } catch (error) {
    console.error("Failed to save tasks:", error);
  }
}

/**
 * Save or update a single task
 */
export function saveTask(task: Task): void {
  const tasks = loadTasks();
  const idx = tasks.findIndex((t) => t.id === task.id);
  const updated = { ...task, updatedAt: new Date().toISOString() };

  if (idx >= 0) {
    tasks[idx] = updated;
  } else {
    tasks.unshift(updated);
  }

  saveTasks(tasks);
}

/**
 * Delete a task by ID
 */
export function deleteTask(id: string): void {
  const tasks = loadTasks().filter((t) => t.id !== id);
  saveTasks(tasks);
}

/**
 * Get a single task by ID
 */
export function getTaskById(id: string): Task | undefined {
  return loadTasks().find((t) => t.id === id);
}

/**
 * Get all active tasks
 */
export function getActiveTasks(): Task[] {
  return loadTasks().filter((t) => t.status === "active");
}

/**
 * Get all tasks due for execution (nextRunAt is now or in the past)
 */
export function getDueTasks(): Task[] {
  const now = new Date();
  return getActiveTasks().filter(
    (t) => t.nextRunAt && new Date(t.nextRunAt) <= now
  );
}

/**
 * Compute next run time based on task cadence
 * Used after each successful run to update nextRunAt
 */
export function computeNextRunAt(task: Task): string {
  const base = task.lastRunAt ? new Date(task.lastRunAt) : new Date();
  const next = new Date(base);

  if (task.cadence.unit === "days") {
    next.setDate(next.getDate() + task.cadence.every);
  } else {
    // weeks
    next.setDate(next.getDate() + task.cadence.every * 7);
  }

  return next.toISOString();
}
