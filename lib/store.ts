"use client";

import { PostPlan } from "./types";
import { dispatchPostsUpdated } from "./post-events";
import { getConvexClient } from "./convex-client";
import { api } from "@/convex/_generated/api";

/**
 * Strips large base64 images from a post before saving.
 * Keeps URLs (FAL, Convex storage) and userProvided base64 images.
 */
function stripLargeData(post: PostPlan): PostPlan {
  return {
    ...post,
    referenceImages: [],
    imagePrompts: post.imagePrompts.map((ip) => ({
      ...ip,
      referenceImages: ip.referenceImages.filter((r) => !r.startsWith("data:")),
    })),
    generatedImages: post.generatedImages
      .map((img) => ({
        ...img,
        url: !img.userProvided && img.url.startsWith("data:") ? "" : img.url,
      }))
      .filter((img) => img.url),
  };
}

/**
 * Load posts from Convex (async). Falls back to localStorage during migration.
 * For synchronous access in React, use usePostStore() hook instead.
 */
export async function loadPostsAsync(): Promise<PostPlan[]> {
  try {
    const client = getConvexClient();
    const rows = await client.query(api.posts.list);
    return rows
      .map((row: { data: string }) => JSON.parse(row.data) as PostPlan)
      .sort(
        (a: PostPlan, b: PostPlan) =>
          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
  } catch (error) {
    console.error("[Store] Failed to load posts from Convex:", error);
    return [];
  }
}

/**
 * Synchronous loadPosts — reads from localStorage cache.
 * The usePostStore hook keeps this cache updated from Convex.
 * Falls back to the old localStorage key for pre-migration data.
 * Non-React code should prefer loadPostsAsync() when possible.
 */
export function loadPosts(): PostPlan[] {
  if (typeof window === "undefined") return [];
  try {
    // Try the Convex-synced cache first
    const cached = localStorage.getItem("ai-influencer-posts-cache");
    if (cached) return JSON.parse(cached) as PostPlan[];

    // Fallback to old localStorage key (pre-migration)
    const legacy = localStorage.getItem("ai-influencer-posts");
    if (legacy) return JSON.parse(legacy) as PostPlan[];

    return [];
  } catch {
    return [];
  }
}

/**
 * Update the local cache (called by the React hook when Convex data changes).
 */
export function updatePostsCache(posts: PostPlan[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("ai-influencer-posts-cache", JSON.stringify(posts));
  } catch {
    // Ignore quota errors for cache
  }
}

/**
 * Save a post to Convex. Fires mutation asynchronously.
 * Dispatches POSTS_UPDATED_EVENT for immediate UI feedback.
 */
export function savePost(post: PostPlan): void {
  const updated = { ...post, updatedAt: new Date().toISOString() };
  const stripped = stripLargeData(updated);

  // Fire-and-forget Convex mutation
  try {
    const client = getConvexClient();
    client.mutation(api.posts.save, {
      postId: stripped.id,
      data: JSON.stringify(stripped),
    });
  } catch (error) {
    console.error("[Store] Failed to save post to Convex:", error);
  }

  // Dispatch event for immediate UI update (usePostStore will get the
  // real Convex update via useQuery reactivity shortly after)
  dispatchPostsUpdated();
}

/**
 * Delete a post from Convex.
 */
export function deletePost(id: string): void {
  try {
    const client = getConvexClient();
    client.mutation(api.posts.remove, { postId: id });
  } catch (error) {
    console.error("[Store] Failed to delete post from Convex:", error);
  }

  dispatchPostsUpdated();
}

/**
 * Get posts filtered by status (reads from cache).
 */
export function getPostsByStatus(
  status: PostPlan["status"] | PostPlan["status"][]
): PostPlan[] {
  const posts = loadPosts();
  const statuses = Array.isArray(status) ? status : [status];
  return posts.filter((p) => statuses.includes(p.status));
}
