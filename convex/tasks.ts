import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .collect();
  },
});

export const getById = query({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const task = await ctx.db.get(id);
    if (!task || task.userId !== userId) return null;
    return task;
  },
});

export const getByExternalId = query({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("tasks")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .first();
  },
});

export const getActive = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query("tasks")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", userId).eq("status", "running")
      )
      .collect();
  },
});

export const getDue = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const now = new Date().toISOString();
    const activeTasks = await ctx.db
      .query("tasks")
      .withIndex("by_userId_status", (q) =>
        q.eq("userId", userId).eq("status", "running")
      )
      .collect();
    return activeTasks.filter(
      (t) => t.nextRunAt !== null && t.nextRunAt <= now
    );
  },
});

export const save = mutation({
  args: {
    id: v.optional(v.id("tasks")),
    externalId: v.string(),
    name: v.string(),
    description: v.string(),
    status: v.string(),
    approvalMode: v.string(),
    cadence: v.object({
      every: v.number(),
      unit: v.string(),
    }),
    scheduledTime: v.union(v.string(), v.null()),
    defaultPostType: v.string(),
    defaultImageSize: v.string(),
    fallbackLocations: v.array(
      v.object({
        location: v.string(),
        weight: v.number(),
      })
    ),
    fallbackNotes: v.string(),
    inspirationItems: v.array(v.any()),
    createdAt: v.string(),
    updatedAt: v.string(),
    lastRunAt: v.union(v.string(), v.null()),
    nextRunAt: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const { id, ...data } = args;
    const now = new Date().toISOString();

    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.userId !== userId) {
        throw new Error("Task not found");
      }
      await ctx.db.patch(id, { ...data, updatedAt: now });
      return id;
    }

    // Upsert by externalId
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_externalId", (q) => q.eq("externalId", args.externalId))
      .first();

    if (existing) {
      if (existing.userId !== userId) throw new Error("Task not found");
      await ctx.db.patch(existing._id, { ...data, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert("tasks", { ...data, userId, updatedAt: now });
  },
});

export const remove = mutation({
  args: { id: v.id("tasks") },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const task = await ctx.db.get(id);
    if (!task || task.userId !== userId) throw new Error("Task not found");
    await ctx.db.delete(id);
  },
});

export const removeByExternalId = mutation({
  args: { externalId: v.string() },
  handler: async (ctx, { externalId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const task = await ctx.db
      .query("tasks")
      .withIndex("by_externalId", (q) => q.eq("externalId", externalId))
      .first();
    if (!task || task.userId !== userId) throw new Error("Task not found");
    await ctx.db.delete(task._id);
  },
});
