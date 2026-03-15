import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("posts").collect();
    return rows.map((row) => ({
      _id: row._id,
      postId: row.postId,
      data: row.data,
    }));
  },
});

export const get = query({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("posts")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .unique();
    return row ? { _id: row._id, postId: row.postId, data: row.data } : null;
  },
});

export const save = mutation({
  args: { postId: v.string(), data: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { data: args.data });
    } else {
      await ctx.db.insert("posts", {
        postId: args.postId,
        data: args.data,
      });
    }
  },
});

/**
 * Atomically claim a post for advancement.
 * Returns { claimed: true, data } if the lock was acquired,
 * or { claimed: false } if another worker already holds it.
 */
export const claimAdvance = mutation({
  args: {
    postId: v.string(),
    lockTtlMs: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .unique();

    if (!existing) return { claimed: false };

    let post: Record<string, unknown>;
    try {
      post = JSON.parse(existing.data);
    } catch {
      return { claimed: false };
    }

    // If advancingAt is set and not expired, someone else has the lock
    if (post.advancingAt) {
      const lockAge = Date.now() - new Date(post.advancingAt as string).getTime();
      if (lockAge < args.lockTtlMs) {
        return { claimed: false };
      }
    }

    // Atomically set the lock
    const now = new Date().toISOString();
    const updated = { ...post, advancingAt: now, updatedAt: now };
    await ctx.db.patch(existing._id, { data: JSON.stringify(updated) });

    return { claimed: true, data: JSON.stringify(updated) };
  },
});

export const remove = mutation({
  args: { postId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});
