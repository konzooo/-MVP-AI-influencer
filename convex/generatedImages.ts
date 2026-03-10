import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const images = await ctx.db
      .query("generatedImages")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();

    // Resolve storage URLs
    return await Promise.all(
      images.map(async (img) => {
        const imageUrl = await ctx.storage.getUrl(img.storageId);
        return { ...img, imageUrl: imageUrl ?? "" };
      })
    );
  },
});

export const getByPostId = query({
  args: { postId: v.string() },
  handler: async (ctx, { postId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const images = await ctx.db
      .query("generatedImages")
      .withIndex("by_postId", (q) => q.eq("postId", postId))
      .collect();

    return await Promise.all(
      images.map(async (img) => {
        const imageUrl = await ctx.storage.getUrl(img.storageId);
        return { ...img, imageUrl: imageUrl ?? "" };
      })
    );
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const save = mutation({
  args: {
    storageId: v.id("_storage"),
    filename: v.string(),
    prompt: v.string(),
    seed: v.optional(v.number()),
    model: v.string(),
    postId: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("generatedImages", {
      ...args,
      userId,
      createdAt: new Date().toISOString(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("generatedImages") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const img = await ctx.db.get(id);
    if (!img || img.userId !== userId) throw new Error("Not found");
    await ctx.storage.delete(img.storageId).catch(() => {});
    await ctx.db.delete(id);
  },
});

// ─── Internal: for AI workflows ───────────────────────────────────────────────

export const internalSave = internalMutation({
  args: {
    userId: v.id("users"),
    storageId: v.id("_storage"),
    filename: v.string(),
    prompt: v.string(),
    seed: v.optional(v.number()),
    model: v.string(),
    postId: v.optional(v.string()),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generatedImages", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});
