/**
 * Internal queries and mutations for the server-side task runner.
 * These bypass auth checks since they're called from internal Convex actions.
 */

import { v } from "convex/values";
import { internalQuery, internalMutation } from "./_generated/server";

// ─── Tasks ────────────────────────────────────────────────────────────────────

export const getDueTasks = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = new Date().toISOString();
    const running = await ctx.db
      .query("tasks")
      .filter((q) => q.eq(q.field("status"), "running"))
      .collect();
    return running.filter((t) => t.nextRunAt !== null && t.nextRunAt <= now);
  },
});

export const getTask = internalQuery({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

export const updateTask = internalMutation({
  args: {
    id: v.id("tasks"),
    patch: v.any(),
  },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id, { ...patch, updatedAt: new Date().toISOString() });
  },
});

// ─── Posts ────────────────────────────────────────────────────────────────────

export const insertPost = internalMutation({
  args: {
    userId: v.id("users"),
    externalId: v.string(),
    status: v.string(),
    creationMode: v.string(),
    postType: v.string(),
    title: v.string(),
    description: v.string(),
    caption: v.string(),
    hashtags: v.array(v.string()),
    notes: v.string(),
    imagePrompts: v.array(
      v.object({
        prompt: v.string(),
        negativePrompt: v.optional(v.string()),
        referenceImages: v.array(v.string()),
        referenceImageAnalysis: v.optional(v.string()),
      })
    ),
    referenceImages: v.array(v.string()),
    generatedImages: v.array(
      v.object({
        id: v.string(),
        url: v.string(),
        prompt: v.string(),
        seed: v.optional(v.number()),
        settings: v.object({
          imageSize: v.string(),
          seed: v.optional(v.number()),
          numImages: v.number(),
          numVariations: v.number(),
          enableSafetyChecker: v.boolean(),
        }),
        selected: v.boolean(),
        createdAt: v.string(),
        promptIndex: v.optional(v.number()),
        userProvided: v.optional(v.boolean()),
      })
    ),
    generationHistory: v.array(v.any()),
    taskId: v.optional(v.string()),
    taskItemId: v.optional(v.string()),
    selectedCharacterRefId: v.optional(v.string()),
    selectedCharacterRefPath: v.optional(v.string()),
    characterRefs: v.optional(v.array(v.object({ id: v.string(), path: v.string() }))),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("posts", args);
  },
});

export const updatePost = internalMutation({
  args: {
    id: v.id("posts"),
    patch: v.any(),
  },
  handler: async (ctx, { id, patch }) => {
    await ctx.db.patch(id, { ...patch, updatedAt: new Date().toISOString() });
  },
});

// ─── Settings (for reading identity + AI settings) ────────────────────────────

export const getSettingsByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("settings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();
  },
});

// ─── Reference Images ─────────────────────────────────────────────────────────

export const getReferenceImagesByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("referenceImages")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getReferenceImageUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, { storageId }) => {
    return await ctx.storage.getUrl(storageId);
  },
});
