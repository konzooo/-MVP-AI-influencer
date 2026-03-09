import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Queries ──────────────────────────────────────────────────────────────────

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const refs = await ctx.db
      .query("referenceImages")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();

    // Resolve storage URLs
    return await Promise.all(
      refs.map(async (ref) => {
        const imageUrl = await ctx.storage.getUrl(ref.storageId);
        const thumbnailUrl = ref.thumbnailStorageId
          ? await ctx.storage.getUrl(ref.thumbnailStorageId)
          : imageUrl;
        return {
          ...ref,
          imageUrl: imageUrl ?? "",
          thumbnailUrl: thumbnailUrl ?? imageUrl ?? "",
        };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("referenceImages") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const ref = await ctx.db.get(id);
    if (!ref || ref.userId !== userId) return null;
    const imageUrl = await ctx.storage.getUrl(ref.storageId);
    const thumbnailUrl = ref.thumbnailStorageId
      ? await ctx.storage.getUrl(ref.thumbnailStorageId)
      : imageUrl;
    return { ...ref, imageUrl: imageUrl ?? "", thumbnailUrl: thumbnailUrl ?? imageUrl ?? "" };
  },
});

// ─── Upload URL generation ────────────────────────────────────────────────────

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.storage.generateUploadUrl();
  },
});

// ─── Mutations ────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    filename: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    summary: v.string(),
    tags: v.array(v.string()),
    metadata: v.object({
      schema_version: v.string(),
      indoor_outdoor: v.string(),
      place: v.object({ type: v.string(), detail: v.string() }),
      capture_method: v.string(),
      framing: v.string(),
      expression: v.object({ type: v.string(), mouth: v.string(), detail: v.string() }),
      time_of_day: v.string(),
      image_style: v.object({ color: v.string(), detail: v.string() }),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    return await ctx.db.insert("referenceImages", {
      ...args,
      userId,
      createdAt: new Date().toISOString(),
    });
  },
});

export const updateMeta = mutation({
  args: {
    id: v.id("referenceImages"),
    summary: v.string(),
    tags: v.array(v.string()),
    metadata: v.object({
      schema_version: v.string(),
      indoor_outdoor: v.string(),
      place: v.object({ type: v.string(), detail: v.string() }),
      capture_method: v.string(),
      framing: v.string(),
      expression: v.object({ type: v.string(), mouth: v.string(), detail: v.string() }),
      time_of_day: v.string(),
      image_style: v.object({ color: v.string(), detail: v.string() }),
    }),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const ref = await ctx.db.get(id);
    if (!ref || ref.userId !== userId) throw new Error("Not found");
    await ctx.db.patch(id, patch);
  },
});

export const remove = mutation({
  args: { id: v.id("referenceImages") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const ref = await ctx.db.get(id);
    if (!ref || ref.userId !== userId) throw new Error("Not found");
    // Delete from storage
    await ctx.storage.delete(ref.storageId);
    if (ref.thumbnailStorageId) {
      await ctx.storage.delete(ref.thumbnailStorageId);
    }
    await ctx.db.delete(id);
  },
});

// ─── Internal: migration helper ───────────────────────────────────────────────
// Used by the migration script via `npx convex run referenceImages:internalCreate`

export const internalCreate = internalMutation({
  args: {
    userId: v.id("users"),
    filename: v.string(),
    storageId: v.id("_storage"),
    summary: v.string(),
    tags: v.array(v.string()),
    metadata: v.object({
      schema_version: v.string(),
      indoor_outdoor: v.string(),
      place: v.object({ type: v.string(), detail: v.string() }),
      capture_method: v.string(),
      framing: v.string(),
      expression: v.object({ type: v.string(), mouth: v.string(), detail: v.string() }),
      time_of_day: v.string(),
      image_style: v.object({ color: v.string(), detail: v.string() }),
    }),
  },
  handler: async (ctx, args) => {
    // Skip if already exists
    const existing = await ctx.db
      .query("referenceImages")
      .withIndex("by_userId", (q) => q.eq("userId", args.userId))
      .filter((q) => q.eq(q.field("filename"), args.filename))
      .first();
    if (existing) return existing._id;

    return await ctx.db.insert("referenceImages", {
      ...args,
      createdAt: new Date().toISOString(),
    });
  },
});
