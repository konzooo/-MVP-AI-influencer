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
  args: {
    // Allow passing either a Convex _id (for updates) or just externalId (for creates)
    id: v.optional(v.id("posts")),
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
    storyConfig: v.optional(
      v.object({
        textOverlay: v.optional(v.string()),
        linkUrl: v.optional(v.string()),
        duration: v.optional(v.number()),
        backgroundColor: v.optional(v.string()),
      })
    ),
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
    generationHistory: v.array(
      v.object({
        id: v.string(),
        prompt: v.string(),
        settings: v.object({
          imageSize: v.string(),
          seed: v.optional(v.number()),
          numImages: v.number(),
          numVariations: v.number(),
          enableSafetyChecker: v.boolean(),
        }),
        images: v.array(
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
        createdAt: v.string(),
      })
    ),
    publishingInfo: v.optional(
      v.object({
        status: v.string(),
        igPostId: v.optional(v.string()),
        permalink: v.optional(v.string()),
        publishedAt: v.optional(v.string()),
        scheduledFor: v.optional(v.string()),
        error: v.optional(v.string()),
      })
    ),
    taskId: v.optional(v.string()),
    taskItemId: v.optional(v.string()),
    selectedCharacterRefId: v.optional(v.string()),
    selectedCharacterRefPath: v.optional(v.string()),
    characterRefs: v.optional(
      v.array(v.object({ id: v.string(), path: v.string() }))
    ),
    createdAt: v.string(),
    updatedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...data } = args;
    const now = new Date().toISOString();

    if (id) {
      // Update existing post
      const existing = await ctx.db.get(id);
      if (!existing || existing.userId !== userId) {
        throw new Error("Post not found");
      }
      await ctx.db.patch(id, { ...data, updatedAt: now });
      return id;
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
