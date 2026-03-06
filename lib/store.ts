"use client";

import { PostPlan } from "./types";
import { dispatchPostsUpdated } from "./post-events";

const STORAGE_KEY = "ai-influencer-posts";

/**
 * Strips large base64 images from a post before saving to localStorage
 * to avoid quota exceeded errors. Reference images are temporary working
 * data and can be re-uploaded. Generated images are URLs, so they're kept.
 */
function stripLargeData(post: PostPlan): PostPlan {
  return {
    ...post,
    // Remove base64 reference images (temporary working data)
    referenceImages: [],
    // Remove base64 from per-prompt reference images, but keep URLs (e.g. FAL URLs)
    imagePrompts: post.imagePrompts.map((ip) => ({
      ...ip,
      referenceImages: ip.referenceImages.filter((r) => !r.startsWith("data:")),
    })),
    // Remove base64 generated images (fallback when upload fails) - keep only URLs
    // ALWAYS keep userProvided images (the user's own photos) even if base64
    generatedImages: post.generatedImages.map((img) => ({
      ...img,
      url: !img.userProvided && img.url.startsWith("data:") ? "" : img.url,
    })).filter((img) => img.url), // Remove images with no URL
    // Keep everything else as-is
  };
}

export function loadPosts(): PostPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const posts = JSON.parse(raw);

    // If we detect old data with large base64 images, strip them
    // This handles migration from the old storage format
    const cleaned = posts.map((post: PostPlan) => {
      const hasLargeData =
        post.referenceImages?.some((img: string) => img.startsWith("data:")) ||
        post.imagePrompts?.some((ip) =>
          ip.referenceImages?.some((img: string) => img.startsWith("data:"))
        ) ||
        post.generatedImages?.some((img) => !img.userProvided && img.url.startsWith("data:"));

      return hasLargeData ? stripLargeData(post) : post;
    });

    // If we cleaned anything, re-save immediately
    if (JSON.stringify(cleaned) !== JSON.stringify(posts)) {
      savePosts(cleaned);
    }

    return cleaned;
  } catch (error) {
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.error("[Store] localStorage quota exceeded, clearing all posts to recover:", error);
      // Storage is full, clear it completely
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        // Ignore if removal fails
      }
    } else {
      console.error("[Store] Failed to load posts, clearing corrupted data:", error);
      localStorage.removeItem(STORAGE_KEY);
    }
    return [];
  }
}

export function savePosts(posts: PostPlan[]): void {
  if (typeof window === "undefined") return;
  try {
    // Strip large data before saving
    const stripped = posts.map(stripLargeData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stripped));
  } catch (error) {
    // Check if it's a quota error
    if (error instanceof Error && error.name === "QuotaExceededError") {
      console.error("[Store] localStorage quota exceeded. Clearing old posts to make space.", error);
      // Try to free up space by removing oldest posts
      try {
        const stripped = posts.map(stripLargeData);
        // Keep only the 5 most recent posts
        const recent = stripped.slice(0, 5);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(recent));
      } catch (retryError) {
        console.error("[Store] Failed even after cleanup:", retryError);
      }
    } else {
      console.error("[Store] Failed to save posts to localStorage:", error);
    }
  }
}

export function savePost(post: PostPlan): PostPlan[] {
  const posts = loadPosts();
  const idx = posts.findIndex((p) => p.id === post.id);
  const updated = { ...post, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    posts[idx] = updated;
  } else {
    posts.unshift(updated);
  }
  savePosts(posts);
  dispatchPostsUpdated();
  return posts;
}

export function deletePost(id: string): PostPlan[] {
  const posts = loadPosts().filter((p) => p.id !== id);
  savePosts(posts);
  dispatchPostsUpdated();
  return posts;
}

export function getPostsByStatus(
  status: PostPlan["status"] | PostPlan["status"][]
): PostPlan[] {
  const posts = loadPosts();
  const statuses = Array.isArray(status) ? status : [status];
  return posts.filter((p) => statuses.includes(p.status));
}
