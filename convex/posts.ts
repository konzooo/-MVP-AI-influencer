import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("posts")
      .withIndex("by_userId_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const post = await ctx.db.get(id);
    if (!post || post.userId !== userId) return null;
    return post;
  },
});

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("posts")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .first();
  },
});

export const getByStatus = query({
  args: { statuses: v.array(v.string()) },
  handler: async (ctx, { statuses }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    // For single status, use the index; for multiple, filter
    if (statuses.length === 1) {
      return await ctx.db
        .query("posts")
        .withIndex("by_userId_status", (q) =>
          q.eq("userId", userId).eq("status", statuses[0])
        )
        .collect();
    }
    const allPosts = await ctx.db
      .query("posts")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
    return allPosts.filter((p) => statuses.includes(p.status));
  },
});

export const save = mutation({
  // Accept any shape — client may include Convex internal fields (_creationTime, userId, etc.)
  // that we strip in the handler. Strict validation is enforced by the schema on insert/patch.
  args: v.any(),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Strip Convex internal fields that must not be written back
    const {
      id,
      _id,
      _creationTime,
      userId: _userId,
      ...data
    } = args as any;

    // id field: prefer explicit id arg, fall back to _id (both are the Convex doc ID)
    const docId = id ?? _id;

    const now = new Date().toISOString();

    if (docId) {
      // Update existing post
      let existing: any = null;
      try { existing = await ctx.db.get(docId as any); } catch { /* invalid id shape */ }
      if (!existing || existing.userId !== userId) {
        throw new Error("Post not found");
      }
      await ctx.db.patch(existing._id, { ...data, updatedAt: now });
      return existing._id;
    }

    // Check if post with this externalId already exists (upsert)
    const existing = await ctx.db
      .query("posts")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();

    if (existing) {
      if (existing.userId !== userId) throw new Error("Post not found");
      await ctx.db.patch(existing._id, { ...data, updatedAt: now });
      return existing._id;
    }

    // Create new post
    return await ctx.db.insert("posts", { ...data, userId, updatedAt: now });
  },
});

export const remove = mutation({
  args: { id: v.id("posts") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const post = await ctx.db.get(id);
    if (!post || post.userId !== userId) throw new Error("Post not found");
    await ctx.db.delete(id);
  },
});

export const removeByExternalId = mutation({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const post = await ctx.db
      .query("posts")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .first();
    if (!post || post.userId !== userId) throw new Error("Post not found");
    await ctx.db.delete(post._id);
  },
});
