import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const record = mutation({
  args: {
    entryType: v.string(),
    timestamp: v.string(),
    cost: v.number(),
    provider: v.optional(v.string()),
    callType: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("costLog", {
      entryType: args.entryType,
      timestamp: args.timestamp,
      cost: args.cost,
      provider: args.provider,
      callType: args.callType,
      inputTokens: args.inputTokens,
      outputTokens: args.outputTokens,
      model: args.model,
    });
  },
});

export const getRecent = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const days = args.days ?? 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString();

    const rows = await ctx.db
      .query("costLog")
      .withIndex("by_timestamp")
      .collect();

    return rows.filter((r) => r.timestamp >= cutoffStr);
  },
});

export const getDailySpend = query({
  handler: async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const rows = await ctx.db
      .query("costLog")
      .withIndex("by_timestamp")
      .collect();

    return rows
      .filter((r) => r.timestamp >= todayStr && r.entryType === "generation")
      .reduce((sum, r) => sum + r.cost, 0);
  },
});
