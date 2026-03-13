/**
 * Server-safe post persistence helpers.
 * No "use client" — safe to import from API routes and server components.
 */
import { PostPlan } from "./types";
import { getConvexClient } from "./convex-client";
import { api } from "@/convex/_generated/api";

function stripLargeData(post: PostPlan): PostPlan {
  const imagePrompts = Array.isArray(post.imagePrompts) ? post.imagePrompts : [];
  const generatedImages = Array.isArray(post.generatedImages) ? post.generatedImages : [];

  return {
    ...post,
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    generationHistory: Array.isArray(post.generationHistory) ? post.generationHistory : [],
    referenceImages: [],
    imagePrompts: imagePrompts.map((ip) => ({
      ...ip,
      referenceImages: Array.isArray(ip.referenceImages)
        ? ip.referenceImages.filter((r) => !r.startsWith("data:"))
        : [],
    })),
    generatedImages: generatedImages
      .map((img) => ({
        ...img,
        url:
          typeof img.url !== "string"
            ? ""
            : !img.userProvided && img.url.startsWith("data:")
              ? ""
              : img.url,
      }))
      .filter((img) => img.url),
  };
}

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

export async function savePostAsync(post: PostPlan): Promise<void> {
  const updated = { ...post, updatedAt: new Date().toISOString() };
  const stripped = stripLargeData(updated);
  const client = getConvexClient();

  await client.mutation(api.posts.save, {
    postId: stripped.id,
    data: JSON.stringify(stripped),
  });
}
