import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const rows = await ctx.db.query("generatedImages").collect();
    // Sort by createdAt descending
    rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (args.limit) {
      return rows.slice(0, args.limit);
    }
    return rows;
  },
});

export const get = query({
  args: { imageId: v.string() },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("generatedImages")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .collect();

    return rows[0] ?? null;
  },
});

export const add = mutation({
  args: {
    imageId: v.string(),
    storageId: v.id("_storage"),
    prompt: v.string(),
    postId: v.optional(v.string()),
    postTitle: v.optional(v.string()),
    promptIndex: v.optional(v.number()),
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existingRows = await ctx.db
      .query("generatedImages")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .collect();
    const existing = existingRows[0];

    if (existing) {
      await ctx.db.patch(existing._id, {
        prompt: args.prompt,
        postId: args.postId,
        postTitle: args.postTitle,
        promptIndex: args.promptIndex,
      });
    } else {
      await ctx.db.insert("generatedImages", {
        imageId: args.imageId,
        storageId: args.storageId,
        prompt: args.prompt,
        postId: args.postId,
        postTitle: args.postTitle,
        promptIndex: args.promptIndex,
        createdAt: args.createdAt,
      });
    }
  },
});

export const remove = mutation({
  args: { imageId: v.string() },
  handler: async (ctx, args) => {
    const existingRows = await ctx.db
      .query("generatedImages")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .collect();
    const existing = existingRows[0];

    if (existing) {
      // Delete storage file too
      await ctx.storage.delete(existing.storageId);
      await ctx.db.delete(existing._id);
    }
  },
});
