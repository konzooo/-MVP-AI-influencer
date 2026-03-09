"use client";

import { ConvexReactClient } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostPlan } from "./types";
import { Task } from "./task-types";

// Shared Convex client instance for imperative (non-hook) usage.
// This is the same client that ConvexClientProvider uses.
let _client: ConvexReactClient | null = null;

export function getConvexClient(): ConvexReactClient {
  if (!_client) {
    _client = new ConvexReactClient(
      process.env.NEXT_PUBLIC_CONVEX_URL as string
    );
  }
  return _client;
}

/**
 * Set the shared client (called from ConvexClientProvider so we reuse
 * the same authenticated client instance).
 */
export function setConvexClient(client: ConvexReactClient) {
  _client = client;
}

/**
 * Imperative savePost — for use outside React components (brainstorm.ts, task-runner.ts, etc.)
 * Upserts to Convex by externalId.
 */
export async function savePostToConvex(post: PostPlan): Promise<void> {
  const client = getConvexClient();
  const { id, ...rest } = post as any;
  const _id = (post as any)._id;
  await client.mutation(api.posts.save, {
    ...rest,
    id: _id,
    externalId: id,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Imperative deletePost — for use outside React components.
 */
export async function deletePostFromConvex(externalId: string): Promise<void> {
  const client = getConvexClient();
  await client.mutation(api.posts.removeByExternalId, { externalId });
}

/**
 * Imperative loadPosts — returns all posts for the current user.
 */
export async function loadPostsFromConvex(): Promise<PostPlan[]> {
  const client = getConvexClient();
  const docs = await client.query(api.posts.list);
  return docs.map((doc: any) => ({ ...doc, id: doc.externalId }));
}

/**
 * Imperative saveTask — for use outside React components.
 */
export async function saveTaskToConvex(task: Task): Promise<void> {
  const client = getConvexClient();
  const { id, ...rest } = task as any;
  const _id = (task as any)._id;
  await client.mutation(api.tasks.save, {
    ...rest,
    id: _id,
    externalId: id,
    updatedAt: new Date().toISOString(),
  });
}

/**
 * Imperative deleteTask — for use outside React components.
 */
export async function deleteTaskFromConvex(externalId: string): Promise<void> {
  const client = getConvexClient();
  await client.mutation(api.tasks.removeByExternalId, { externalId });
}
