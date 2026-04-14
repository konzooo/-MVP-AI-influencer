import { internalAction } from "./_generated/server";

async function callCronEndpoint(path: string, label: string): Promise<void> {
  const appUrl = process.env.APP_URL;
  if (!appUrl) {
    console.log(`[${label}] APP_URL env var not set, skipping`);
    return;
  }

  const cronSecret = process.env.CRON_SECRET;

  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (cronSecret) {
      headers["Authorization"] = `Bearer ${cronSecret}`;
    }

    const res = await fetch(`${appUrl}${path}`, {
      method: "POST",
      headers,
    });

    if (!res.ok) {
      const text = await res.text();
      console.error(`[${label}] API returned ${res.status}: ${text}`);
      return;
    }

    const result = await res.json();
    console.log(`[${label}] Result:`, JSON.stringify(result));
  } catch (error) {
    console.error(`[${label}] Failed to call ${path}:`, error);
  }
}

/**
 * Internal action called by the Convex cron.
 * Triggers the Next.js /api/run-due-tasks endpoint via HTTP.
 */
export const checkDueTasks = internalAction({
  handler: async () => {
    await callCronEndpoint("/api/run-automation", "TaskRunner");
  },
});

/**
 * Internal action called by the Convex cron.
 * Triggers the Next.js /api/run-due-posts endpoint via HTTP.
 */
export const checkDuePosts = internalAction({
  handler: async () => {
    await callCronEndpoint("/api/run-automation", "PostRunner");
  },
});

/**
 * Internal action called by the Convex cron.
 * Legacy compatibility entrypoint. The unified automation runner now handles
 * scheduling, task-created posts, and due publishes in one place.
 */
export const advancePosts = internalAction({
  handler: async () => {
    await callCronEndpoint("/api/run-automation", "AdvancePosts");
  },
});
