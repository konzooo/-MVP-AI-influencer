import { v } from "convex/values";
import { query, mutation, internalQuery } from "./_generated/server";

export const list = query({
  handler: async (ctx) => {
    const rows = await ctx.db.query("tasks").collect();
    return rows.map((row) => ({
      _id: row._id,
      taskId: row.taskId,
      data: row.data,
    }));
  },
});

export const get = query({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();
    return row ? { _id: row._id, taskId: row.taskId, data: row.data } : null;
  },
});

export const save = mutation({
  args: { taskId: v.string(), data: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, { data: args.data });
    } else {
      await ctx.db.insert("tasks", {
        taskId: args.taskId,
        data: args.data,
      });
    }
  },
});

export const claimRun = mutation({
  args: {
    taskId: v.string(),
    expectedNextRunAt: v.string(),
    lastRunAt: v.string(),
    nextRunAt: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();

    if (!existing) {
      return { claimed: false };
    }

    let task: {
      status?: string;
      nextRunAt?: string | null;
      [key: string]: unknown;
    };

    try {
      task = JSON.parse(existing.data);
    } catch {
      return { claimed: false };
    }

    if (
      task.status !== "running" ||
      !task.nextRunAt ||
      task.nextRunAt !== args.expectedNextRunAt ||
      new Date(task.nextRunAt) > new Date()
    ) {
      return { claimed: false };
    }

    const updated = {
      ...task,
      lastRunAt: args.lastRunAt,
      nextRunAt: args.nextRunAt,
      updatedAt: args.lastRunAt,
    };

    await ctx.db.patch(existing._id, { data: JSON.stringify(updated) });

    return {
      claimed: true,
      data: JSON.stringify(updated),
    };
  },
});

export const remove = mutation({
  args: { taskId: v.string() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("tasks")
      .withIndex("by_taskId", (q) => q.eq("taskId", args.taskId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

/** Internal query used by the cron — returns tasks that are due for execution */
export const getDueTasks = internalQuery({
  handler: async (ctx) => {
    const rows = await ctx.db.query("tasks").collect();
    const now = new Date();

    return rows
      .filter((row) => {
        try {
          const task = JSON.parse(row.data);
          return (
            task.status === "running" &&
            task.nextRunAt &&
            new Date(task.nextRunAt) <= now
          );
        } catch {
          return false;
        }
      })
      .map((row) => ({
        taskId: row.taskId,
        data: row.data,
      }));
  },
});
