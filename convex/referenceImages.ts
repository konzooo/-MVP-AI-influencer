import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("referenceImages").collect();
    return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },
});

export const get = query({
  args: { imageId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("referenceImages")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .unique();
  },
});

export const add = mutation({
  args: {
    imageId: v.string(),
    sourceKey: v.string(),
    filename: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    summary: v.string(),
    tags: v.array(v.string()),
    metadata: v.string(), // JSON-stringified
    createdAt: v.string(),
  },
  handler: async (ctx, args) => {
    // Check if already exists
    const existing = await ctx.db
      .query("referenceImages")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        storageId: args.storageId,
        thumbnailStorageId: args.thumbnailStorageId,
        summary: args.summary,
        tags: args.tags,
        metadata: args.metadata,
      });
    } else {
      await ctx.db.insert("referenceImages", {
        imageId: args.imageId,
        sourceKey: args.sourceKey,
        filename: args.filename,
        storageId: args.storageId,
        thumbnailStorageId: args.thumbnailStorageId,
        summary: args.summary,
        tags: args.tags,
        metadata: args.metadata,
        createdAt: args.createdAt,
      });
    }
  },
});

export const updateMetadata = mutation({
  args: {
    imageId: v.string(),
    summary: v.string(),
    tags: v.array(v.string()),
    metadata: v.string(), // JSON-stringified
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("referenceImages")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        summary: args.summary,
        tags: args.tags,
        metadata: args.metadata,
      });
    }
  },
});

export const remove = mutation({
  args: { imageId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("referenceImages")
      .withIndex("by_imageId", (q) => q.eq("imageId", args.imageId))
      .unique();

    if (existing) {
      // Delete storage files
      await ctx.storage.delete(existing.storageId);
      if (existing.thumbnailStorageId) {
        await ctx.storage.delete(existing.thumbnailStorageId);
      }
      await ctx.db.delete(existing._id);
    }
  },
});
