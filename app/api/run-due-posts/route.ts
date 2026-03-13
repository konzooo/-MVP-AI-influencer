import { NextResponse } from "next/server";
import { loadPostsAsync, savePostAsync } from "@/lib/store-server";
import { PostPlan } from "@/lib/types";

function getInternalApiBaseUrl(): string {
  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  );
}

async function publishPost(post: PostPlan): Promise<{
  success: boolean;
  igPostId?: string;
  permalink?: string;
  error?: string;
}> {
  const imageUrls = post.generatedImages
    .filter((image) => image.selected)
    .map((image) => image.url);

  if (imageUrls.length === 0) {
    return {
      success: false,
      error: "No selected images are available for publishing.",
    };
  }

  const response = await fetch(
    new URL("/api/instagram/publish", getInternalApiBaseUrl()).toString(),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrls,
        caption: post.caption,
        hashtags: post.hashtags,
        postType: post.postType,
      }),
    }
  );

  const data = await response.json().catch(() => null);

  if (!response.ok || data?.error) {
    return {
      success: false,
      error: data?.error || `Publish failed with status ${response.status}`,
    };
  }

  return {
    success: true,
    igPostId: data.igPostId,
    permalink: data.permalink,
  };
}

/**
 * POST /api/run-due-posts
 *
 * Cron endpoint — publishes posts whose scheduled time has arrived.
 * Called by Convex cron (every minute) or manually.
 *
 * Optional header: Authorization: Bearer <CRON_SECRET>
 * Set CRON_SECRET env var to protect the endpoint.
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const now = Date.now();
  const posts = await loadPostsAsync();
  const duePosts = posts
    .filter((post) => {
      if (post.status !== "scheduled") return false;
      const scheduledFor = post.publishingInfo?.scheduledFor;
      if (!scheduledFor) return false;
      const scheduledAt = new Date(scheduledFor).getTime();
      return !Number.isNaN(scheduledAt) && scheduledAt <= now;
    })
    .sort((a, b) => {
      const aTime = new Date(a.publishingInfo?.scheduledFor || 0).getTime();
      const bTime = new Date(b.publishingInfo?.scheduledFor || 0).getTime();
      return aTime - bTime;
    });

  if (duePosts.length === 0) {
    return NextResponse.json({ ran: 0, results: [] });
  }

  const results: {
    postId: string;
    title: string;
    success: boolean;
    error: string | null;
  }[] = [];

  for (const post of duePosts) {
    const publishingPost: PostPlan = {
      ...post,
      status: "publishing",
      publishingInfo: {
        ...post.publishingInfo,
        status: "publishing",
        error: undefined,
      },
    };
    await savePostAsync(publishingPost);

    try {
      const result = await publishPost(post);

      if (!result.success) {
        await savePostAsync({
          ...post,
          status: "ready",
          publishingInfo: {
            ...post.publishingInfo,
            status: "failed",
            error: result.error || "Publishing failed",
          },
        });

        results.push({
          postId: post.id,
          title: post.title,
          success: false,
          error: result.error || "Publishing failed",
        });
        continue;
      }

      await savePostAsync({
        ...post,
        status: "posted",
        publishingInfo: {
          ...post.publishingInfo,
          status: "published",
          igPostId: result.igPostId,
          permalink: result.permalink,
          publishedAt: new Date().toISOString(),
          error: undefined,
        },
      });

      results.push({
        postId: post.id,
        title: post.title,
        success: true,
        error: null,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";

      await savePostAsync({
        ...post,
        status: "ready",
        publishingInfo: {
          ...post.publishingInfo,
          status: "failed",
          error: message,
        },
      });

      results.push({
        postId: post.id,
        title: post.title,
        success: false,
        error: message,
      });
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
