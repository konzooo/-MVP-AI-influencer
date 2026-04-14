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

export const claimAutomationState = mutation({
  args: {
    postId: v.string(),
    expectedStatus: v.string(),
    expectedUpdatedAt: v.string(),
    data: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_postId", (q) => q.eq("postId", args.postId))
      .unique();

    if (!existing) {
      return { claimed: false };
    }

    let current: { status?: string; updatedAt?: string; [key: string]: unknown };
    try {
      current = JSON.parse(existing.data);
    } catch {
      return { claimed: false };
    }

    if (
      current.status !== args.expectedStatus ||
      current.updatedAt !== args.expectedUpdatedAt
    ) {
      return { claimed: false };
    }

    await ctx.db.patch(existing._id, { data: args.data });
    return { claimed: true, data: args.data };
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
