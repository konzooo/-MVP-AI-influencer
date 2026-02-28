export const TASKS_UPDATED_EVENT = "tasks-updated";

export function dispatchTasksUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(TASKS_UPDATED_EVENT));
}
