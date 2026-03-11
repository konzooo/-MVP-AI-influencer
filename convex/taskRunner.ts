import { internalAction } from "./_generated/server";

/**
 * Internal action called by the Convex cron.
 * Triggers the Next.js /api/run-due-tasks endpoint via HTTP.
 */
export const checkDueTasks = internalAction({
  handler: async () => {
    const appUrl = process.env.APP_URL;
    if (!appUrl) {
      console.log("[TaskRunner] APP_URL env var not set, skipping");
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

      const res = await fetch(`${appUrl}/api/run-due-tasks`, {
        method: "POST",
        headers,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`[TaskRunner] API returned ${res.status}: ${text}`);
        return;
      }

      const result = await res.json();
      if (result.ran > 0) {
        console.log(
          `[TaskRunner] Ran ${result.ran} task(s):`,
          result.results.map(
            (r: { taskName: string; success: boolean }) =>
              `${r.taskName}: ${r.success ? "OK" : "FAIL"}`
          )
        );
      }
    } catch (error) {
      console.error("[TaskRunner] Failed to call run-due-tasks:", error);
    }
  },
});
