import { getConvexClient } from "./convex-client";
import { api } from "@/convex/_generated/api";

const RATE_LIMIT_KEY = "ai-influencer-ig-rate-limit";
const MAX_POSTS_PER_24H = 25;

interface RateLimitEntry {
  id: string;
  timestamp: string;
}

function loadEntries(): RateLimitEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveEntries(entries: RateLimitEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(entries));
}

/** Record a publish (client-side: localStorage + Convex fire-and-forget). */
export function recordPublish(): void {
  const timestamp = new Date().toISOString();

  // localStorage
  const entries = loadEntries();
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  const pruned = entries.filter((e) => new Date(e.timestamp) > oneDayAgo);
  pruned.push({ id: crypto.randomUUID(), timestamp });
  saveEntries(pruned);

  // Convex (fire-and-forget)
  try {
    const client = getConvexClient();
    client.mutation(api.costLog.record, {
      entryType: "ig_publish",
      timestamp,
      cost: 0,
    });
  } catch {
    // Silently ignore
  }
}

/** Record a publish from the server (async, Convex-backed). */
export async function recordPublishAsync(): Promise<void> {
  const timestamp = new Date().toISOString();
  const client = getConvexClient();
  await client.mutation(api.costLog.record, {
    entryType: "ig_publish",
    timestamp,
    cost: 0,
  });
}

/** Check if publishing is allowed from the server (reads Convex). */
export async function canPublishAsync(): Promise<boolean> {
  const client = getConvexClient();
  const summary = await client.query(api.costLog.getDailySummary);
  return summary.igPublishCount < MAX_POSTS_PER_24H;
}

/** Get number of publishes in last 24 hours (client-side localStorage). */
export function getPublishCountLast24h(): number {
  const entries = loadEntries();
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);
  return entries.filter((e) => new Date(e.timestamp) > oneDayAgo).length;
}

/** Check if publishing is allowed (client-side localStorage). */
export function canPublish(): boolean {
  return getPublishCountLast24h() < MAX_POSTS_PER_24H;
}

/** Get remaining publish allowance. */
export function getRemainingPublishes(): number {
  return Math.max(0, MAX_POSTS_PER_24H - getPublishCountLast24h());
}
