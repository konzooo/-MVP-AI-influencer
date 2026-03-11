"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { PostPlan } from "@/lib/types";

const LS_POSTS_KEY = "ai-influencer-posts";
const LS_COST_LOG_KEY = "ai-influencer-cost-log";
const LS_LLM_LOG_KEY = "ai-influencer-llm-log";

/**
 * One-time migration: if Convex posts are empty but localStorage has data,
 * seed Convex from localStorage. Also migrates cost/LLM logs.
 * Runs silently on app mount.
 */
export function PostsMigration() {
  const convexPosts = useQuery(api.posts.list);
  const savePost = useMutation(api.posts.save);
  const recordCost = useMutation(api.costLog.record);
  const migrated = useRef(false);

  useEffect(() => {
    if (convexPosts === undefined) return; // Still loading
    if (migrated.current) return;
    migrated.current = true;

    // Only migrate if Convex has no posts
    if (convexPosts.length > 0) return;

    // ─── Migrate posts ─────────────────────────────────────────────
    try {
      const raw = localStorage.getItem(LS_POSTS_KEY);
      if (raw) {
        const posts: PostPlan[] = JSON.parse(raw);
        if (posts.length > 0) {
          console.log(`[PostsMigration] Migrating ${posts.length} posts from localStorage to Convex`);
          for (const post of posts) {
            savePost({
              postId: post.id,
              data: JSON.stringify(post),
            });
          }
        }
      }
    } catch {
      // Invalid data, skip
    }

    // ─── Migrate cost log ──────────────────────────────────────────
    try {
      const raw = localStorage.getItem(LS_COST_LOG_KEY);
      if (raw) {
        const entries = JSON.parse(raw);
        if (Array.isArray(entries)) {
          console.log(`[PostsMigration] Migrating ${entries.length} cost log entries`);
          for (const entry of entries) {
            recordCost({
              entryType: "generation",
              timestamp: entry.timestamp,
              cost: entry.cost ?? 0,
            });
          }
        }
      }
    } catch {
      // Invalid data, skip
    }

    // ─── Migrate LLM log ──────────────────────────────────────────
    try {
      const raw = localStorage.getItem(LS_LLM_LOG_KEY);
      if (raw) {
        const entries = JSON.parse(raw);
        if (Array.isArray(entries)) {
          console.log(`[PostsMigration] Migrating ${entries.length} LLM log entries`);
          for (const entry of entries) {
            recordCost({
              entryType: "llm",
              timestamp: entry.timestamp,
              cost: entry.cost ?? 0,
              provider: entry.provider,
              callType: entry.callType,
              inputTokens: entry.inputTokens,
              outputTokens: entry.outputTokens,
              model: entry.model,
            });
          }
        }
      }
    } catch {
      // Invalid data, skip
    }
  }, [convexPosts, savePost, recordCost]);

  return null;
}
