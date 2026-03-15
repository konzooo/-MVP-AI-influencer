/**
 * Post Advancer
 *
 * Advances ONE automatic-mode post per cron tick through the pipeline:
 *   draft/approved → generatePostImages() → ready
 *   generating     → resume generatePostImages() (skips filled slides)
 *   ready          → publish to Instagram → posted
 *
 * Called by POST /api/advance-posts every minute.
 */

import { PostPlan } from "./types";
import { loadPostsAsync, savePostAsync } from "./store-server";
import { loadTasksAsync } from "./task-store";
import { generatePostImages } from "./task-runner";
import { canPublishAsync, recordPublishAsync } from "./instagram-rate-limit";
import { FromScratchInspirationItem } from "./task-types";

const ADVANCING_LOCK_TTL_MS = 90_000; // 90 seconds

export interface AdvanceResult {
  advanced: boolean;
  postId: string | null;
  action: string | null;
  error: string | null;
  log: string[];
}

function getInternalApiBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  );
}

function getInternalApiUrl(path: string): string {
  return new URL(path, getInternalApiBaseUrl()).toString();
}

const STATUS_PRIORITY: Record<string, number> = {
  generating: 4, // highest — resume interrupted work
  ready: 3,      // publish waiting posts
  approved: 2,   // start generation
  draft: 1,      // start generation (from_scratch/copy_post posts land here)
};

export async function advanceOnePost(): Promise<AdvanceResult> {
  const log: string[] = [];
  const addLog = (msg: string) => {
    log.push(msg);
    console.log(`[PostAdvancer] ${msg}`);
  };

  const result: AdvanceResult = {
    advanced: false,
    postId: null,
    action: null,
    error: null,
    log,
  };

  try {
    const [posts, tasks] = await Promise.all([
      loadPostsAsync(),
      loadTasksAsync(),
    ]);

    const taskMap = new Map(tasks.map((t) => [t.id, t]));
    const now = Date.now();

    // Filter to posts that need advancing
    const advanceable = posts.filter((post) => {
      if (!post.taskId) return false;
      const task = taskMap.get(post.taskId);
      if (!task || task.approvalMode !== "automatic") return false;
      if (!STATUS_PRIORITY[post.status]) return false;

      // Skip if currently being advanced (lock not expired)
      if (post.advancingAt) {
        const lockAge = now - new Date(post.advancingAt).getTime();
        if (lockAge < ADVANCING_LOCK_TTL_MS) return false;
        addLog(`Post ${post.id} has stale advancingAt lock (${lockAge}ms old), will reclaim`);
      }

      // For "ready" posts: don't retry publish more than once per 2 minutes
      // (avoids blocking draft/approved posts if Instagram is temporarily down)
      if (post.status === "ready") {
        const updatedAge = now - new Date(post.updatedAt).getTime();
        if (updatedAge < 2 * 60 * 1000) return false;
      }

      return true;
    });

    if (advanceable.length === 0) {
      addLog("No posts need advancing");
      return result;
    }

    // Sort by priority (highest first), then by createdAt (oldest first)
    advanceable.sort((a, b) => {
      const pd = (STATUS_PRIORITY[b.status] ?? 0) - (STATUS_PRIORITY[a.status] ?? 0);
      if (pd !== 0) return pd;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const post = advanceable[0];
    const task = taskMap.get(post.taskId!)!;

    addLog(`Advancing post "${post.title}" (${post.id}) from status "${post.status}"`);

    // Claim the post with an advancingAt lock
    const locked: PostPlan = { ...post, advancingAt: new Date().toISOString() };
    await savePostAsync(locked);

    result.postId = post.id;

    try {
      if (post.status === "draft" || post.status === "approved") {
        // Set approved and generate images
        locked.status = "approved";

        // Determine style mode hint from the inspiration item
        let styleModeHint: string | undefined;
        if (post.taskItemId) {
          const item = task.inspirationItems.find((i) => i.id === post.taskItemId);
          if (item?.type === "from_scratch") {
            const fsItem = item as FromScratchInspirationItem;
            if (fsItem.preferredStyleMode) {
              styleModeHint = fsItem.preferredStyleMode;
            }
          }
        }

        addLog("Starting image generation...");
        const genResult = await generatePostImages(locked, {
          imageSize: task.defaultImageSize,
          styleModeHint,
        });

        for (const line of genResult.log) addLog(line);

        result.action = genResult.success ? "generated" : "generation_partial";
        if (!genResult.success) {
          result.error = genResult.error;
        }

      } else if (post.status === "generating") {
        // Resume partial generation
        addLog("Resuming partial image generation...");
        const genResult = await generatePostImages(locked, {
          imageSize: task.defaultImageSize,
        });

        for (const line of genResult.log) addLog(line);

        result.action = genResult.success ? "generation_resumed" : "generation_partial";
        if (!genResult.success) {
          result.error = genResult.error;
        }

      } else if (post.status === "ready") {
        // Publish to Instagram
        addLog("Checking Instagram connection...");
        const accountRes = await fetch(getInternalApiUrl("/api/instagram/account"));
        const account = await accountRes.json();

        if (!account.connected) {
          addLog("WARNING: Instagram not connected, leaving post at ready");
          result.action = "skipped_not_connected";
        } else if (!(await canPublishAsync())) {
          addLog("WARNING: Daily Instagram post limit reached");
          result.action = "skipped_rate_limit";
        } else {
          addLog("Publishing to Instagram...");
          const imageUrls = locked.generatedImages
            .filter((g) => g.selected)
            .map((g) => g.url);

          const publishRes = await fetch(getInternalApiUrl("/api/instagram/publish"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrls,
              caption: locked.caption,
              hashtags: locked.hashtags,
              postType: locked.postType,
            }),
          });

          if (!publishRes.ok) {
            const err = await publishRes.json();
            addLog(`WARNING: Publish failed: ${err.error}`);
            result.error = err.error;
            result.action = "publish_failed";
          } else {
            const published = await publishRes.json();
            locked.status = "posted";
            locked.publishingInfo = {
              status: "published",
              igPostId: published.igPostId,
              permalink: published.permalink,
              publishedAt: new Date().toISOString(),
            };
            await recordPublishAsync();
            addLog(`Published: ${published.permalink}`);
            result.action = "published";
          }
        }
      }
    } finally {
      // Always clear the lock before saving final state
      locked.advancingAt = undefined;
      await savePostAsync(locked);
    }

    result.advanced = true;
    addLog(`Done — post status: "${locked.status}"`);
    return result;

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    result.error = msg;
    addLog(`EXCEPTION: ${msg}`);
    return result;
  }
}
