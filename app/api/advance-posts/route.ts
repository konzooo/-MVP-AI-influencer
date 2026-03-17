import { NextResponse } from "next/server";
import { loadPostsAsync, savePostAsync } from "@/lib/store-server";
import { loadTasksAsync } from "@/lib/task-store";
import { generatePostImages } from "@/lib/task-runner";
import { canPublishAsync, recordPublishAsync } from "@/lib/instagram-rate-limit";
import { FromScratchInspirationItem } from "@/lib/task-types";

export const maxDuration = 60;

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

/**
 * POST /api/advance-posts
 *
 * Cron endpoint — advances ONE autoAdvance post one step:
 *   approved/draft  → generate images → ready (or generating if partial)
 *   generating      → resume generation → ready
 *   ready           → publish to Instagram → posted
 *
 * Called by Convex cron every minute.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const log: string[] = [];
  const addLog = (msg: string) => {
    log.push(msg);
    console.log(`[AdvancePosts] ${msg}`);
  };

  try {
    const posts = await loadPostsAsync();
    const now = Date.now();

    const ADVANCEABLE_STATUSES: Record<string, number> = {
      generating: 3, // highest — resume interrupted work
      ready: 2,      // publish
      approved: 1,   // start generation
      draft: 1,      // start generation
    };

    // Find autoAdvance posts that need work
    const candidates = posts.filter((post) => {
      if (!post.autoAdvance) return false;
      if (!ADVANCEABLE_STATUSES[post.status]) return false;
      if (post.status === "draft" && post.generationError) {
        if ((post.generationRetryCount || 0) >= 3) return false;
        const age = now - new Date(post.updatedAt).getTime();
        if (age < 5 * 60 * 1000) return false;
      }

      // For "ready" posts: don't retry more than once per 2 minutes
      if (post.status === "ready") {
        const age = now - new Date(post.updatedAt).getTime();
        if (age < 2 * 60 * 1000) return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      return NextResponse.json({ advanced: false, log: ["No posts need advancing"] });
    }

    // Sort by priority then age
    candidates.sort((a, b) => {
      const pd = (ADVANCEABLE_STATUSES[b.status] ?? 0) - (ADVANCEABLE_STATUSES[a.status] ?? 0);
      if (pd !== 0) return pd;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const post = candidates[0];
    addLog(`Advancing "${post.title}" (${post.id}) from status "${post.status}"`);

    // --- GENERATE ---
    if (post.status === "draft" || post.status === "approved" || post.status === "generating") {
      if (post.generationError) {
        addLog(`Retrying generation (attempt ${(post.generationRetryCount || 0) + 1}/3, previous error: ${post.generationError})`);
      }
      post.status = "approved";

      // Load task for imageSize + styleModeHint
      let imageSize = "landscape_4_3";
      let styleModeHint: string | undefined;

      if (post.taskId) {
        const tasks = await loadTasksAsync();
        const task = tasks.find((t) => t.id === post.taskId);
        if (task) {
          imageSize = task.defaultImageSize;
          if (post.taskItemId) {
            const item = task.inspirationItems.find((i) => i.id === post.taskItemId);
            if (item?.type === "from_scratch") {
              const fsItem = item as FromScratchInspirationItem;
              if (fsItem.preferredStyleMode) {
                styleModeHint = fsItem.preferredStyleMode;
              }
            }
          }
        }
      }

      addLog("Generating images...");
      const genResult = await generatePostImages(post, { imageSize, styleModeHint });
      for (const line of genResult.log) addLog(line);

      if (!genResult.success) {
        addLog(`Generation incomplete — status: "${post.status}"`);
      }

      return NextResponse.json({
        advanced: true,
        postId: post.id,
        action: genResult.success ? "generated" : "generation_partial",
        status: post.status,
        log,
      });
    }

    // --- PUBLISH ---
    if (post.status === "ready") {
      addLog("Checking Instagram connection...");
      const accountRes = await fetch(getInternalApiUrl("/api/instagram/account"));
      const account = await accountRes.json();

      if (!account.connected) {
        addLog("Instagram not connected — skipping");
        return NextResponse.json({ advanced: false, action: "skipped_not_connected", log });
      }

      if (!(await canPublishAsync())) {
        addLog("Daily post limit reached — skipping");
        return NextResponse.json({ advanced: false, action: "skipped_rate_limit", log });
      }

      addLog("Publishing to Instagram...");
      const imageUrls = post.generatedImages
        .filter((g) => g.selected)
        .map((g) => g.url);

      const publishRes = await fetch(getInternalApiUrl("/api/instagram/publish"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls,
          caption: post.caption,
          hashtags: post.hashtags,
          postType: post.postType,
        }),
      });

      if (!publishRes.ok) {
        const err = await publishRes.json();
        addLog(`Publish failed: ${err.error}`);
        // Touch updatedAt so we don't retry immediately
        await savePostAsync(post);
        return NextResponse.json({ advanced: false, action: "publish_failed", error: err.error, log });
      }

      const published = await publishRes.json();
      post.status = "posted";
      post.publishingInfo = {
        status: "published",
        igPostId: published.igPostId,
        permalink: published.permalink,
        publishedAt: new Date().toISOString(),
      };
      await recordPublishAsync();
      await savePostAsync(post);
      addLog(`Published: ${published.permalink}`);

      return NextResponse.json({ advanced: true, postId: post.id, action: "published", log });
    }

    return NextResponse.json({ advanced: false, log });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    addLog(`ERROR: ${msg}`);
    return NextResponse.json({ advanced: false, error: msg, log });
  }
}
