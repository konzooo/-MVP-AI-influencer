"use client";

import { PostPlan } from "./types";

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
    // Remove base64 reference images from each prompt
    imagePrompts: post.imagePrompts.map((ip) => ({
      ...ip,
      referenceImages: [],
    })),
    // Keep generatedImages - they're URLs, not base64
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
        );
      
      return hasLargeData ? stripLargeData(post) : post;
    });
    
    // If we cleaned anything, re-save immediately
    if (JSON.stringify(cleaned) !== JSON.stringify(posts)) {
      savePosts(cleaned);
    }
    
    return cleaned;
  } catch (error) {
    console.error("Failed to load posts, clearing corrupted data:", error);
    // If localStorage is corrupted, clear it
    localStorage.removeItem(STORAGE_KEY);
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
    console.error("Failed to save posts to localStorage:", error);
    // If storage fails, at least don't crash the app
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
  return posts;
}

export function deletePost(id: string): PostPlan[] {
  const posts = loadPosts().filter((p) => p.id !== id);
  savePosts(posts);
  return posts;
}

export function getPostsByStatus(
  status: PostPlan["status"] | PostPlan["status"][]
): PostPlan[] {
  const posts = loadPosts();
  const statuses = Array.isArray(status) ? status : [status];
  return posts.filter((p) => statuses.includes(p.status));
}
