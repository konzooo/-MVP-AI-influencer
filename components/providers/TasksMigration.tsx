"use client";

import { useEffect } from "react";

const TASKS_LS_KEY = "ai-influencer-tasks";

export function TasksMigration() {
  useEffect(() => {
    try {
      localStorage.removeItem(TASKS_LS_KEY);
    } catch (error) {
      console.error("[TasksMigration] Failed to clear legacy task storage:", error);
    }
  }, []);

  return null;
}
