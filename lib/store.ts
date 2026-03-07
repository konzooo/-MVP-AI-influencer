"use client";

import { PostPlan } from "./types";
import { dispatchPostsUpdated } from "./post-events";
import { createClient } from "./supabase/client";

const STORAGE_KEY = "ai-influencer-posts";

// ─── Supabase helpers ─────────────────────────────────────────────────────────

async function getUserId(): Promise<string | null> {
  try {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

// ─── Local storage fallback ───────────────────────────────────────────────────

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

function loadPostsLocal(): PostPlan[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function savePostsLocal(posts: PostPlan[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(posts.map(stripLargeData)));
  } catch {
    // ignore quota errors — Supabase is now the source of truth
  }
}

// ─── Remote (Supabase) ────────────────────────────────────────────────────────

export async function savePostRemote(post: PostPlan): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const supabase = createClient();
  const stripped = stripLargeData(post);

  await supabase.from("posts").upsert({
    id: post.id,
    user_id: userId,
    data: stripped,
    status: post.status,
    created_at: post.createdAt,
    updated_at: new Date().toISOString(),
  });
}

export async function deletePostRemote(id: string): Promise<void> {
  const userId = await getUserId();
  if (!userId) return;

  const supabase = createClient();
  await supabase.from("posts").delete().eq("id", id).eq("user_id", userId);
}

export async function loadPostsRemote(): Promise<PostPlan[]> {
  const userId = await getUserId();
  if (!userId) return [];

  const supabase = createClient();
  const { data, error } = await supabase
    .from("posts")
    .select("data")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error || !data) return [];
  return data.map((row) => row.data as PostPlan);
}

// ─── Public API (same signatures as before) ───────────────────────────────────

export function loadPosts(): PostPlan[] {
  // Synchronous read from localStorage for immediate UI render.
  // Supabase data is loaded reactively via usePostStore hook.
  return loadPostsLocal();
}

export function savePosts(posts: PostPlan[]): void {
  savePostsLocal(posts);
}

export function savePost(post: PostPlan): PostPlan[] {
  // Sync local update for immediate UI response
  const posts = loadPostsLocal();
  const idx = posts.findIndex((p) => p.id === post.id);
  const updated = { ...post, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    posts[idx] = updated;
  } else {
    posts.unshift(updated);
  }
  savePostsLocal(posts);

  // Async remote save
  savePostRemote(updated).catch((err) =>
    console.error("[store] Remote save failed:", err)
  );

  dispatchPostsUpdated();
  return posts;
}

export function deletePost(id: string): PostPlan[] {
  const posts = loadPostsLocal().filter((p) => p.id !== id);
  savePostsLocal(posts);

  // Async remote delete
  deletePostRemote(id).catch((err) =>
    console.error("[store] Remote delete failed:", err)
  );

  dispatchPostsUpdated();
  return posts;
}

export function getPostsByStatus(
  status: PostPlan["status"] | PostPlan["status"][]
): PostPlan[] {
  const posts = loadPostsLocal();
  const statuses = Array.isArray(status) ? status : [status];
  return posts.filter((p) => statuses.includes(p.status));
}
