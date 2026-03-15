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

/** Full usage summary for the settings dialog (daily + weekly, generation + LLM) */
export const getUsageSummary = query({
  handler: async (ctx) => {
    const now = new Date();

    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayStr = todayStart.toISOString();

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toISOString();

    const rows = await ctx.db
      .query("costLog")
      .withIndex("by_timestamp")
      .collect();

    const weekRows = rows.filter((r) => r.timestamp >= weekStr);
    const todayRows = weekRows.filter((r) => r.timestamp >= todayStr);

    const dailyGenSpend = todayRows
      .filter((r) => r.entryType === "generation")
      .reduce((sum, r) => sum + r.cost, 0);
    const dailyGenCount = todayRows.filter(
      (r) => r.entryType === "generation"
    ).length;
    const weeklyGenSpend = weekRows
      .filter((r) => r.entryType === "generation")
      .reduce((sum, r) => sum + r.cost, 0);

    const todayLlm = todayRows.filter((r) => r.entryType === "llm");
    const weekLlm = weekRows.filter((r) => r.entryType === "llm");

    const claudeDailySpend = todayLlm
      .filter((r) => r.provider === "claude")
      .reduce((sum, r) => sum + r.cost, 0);
    const claudeDailyCount = todayLlm.filter(
      (r) => r.provider === "claude"
    ).length;
    const claudeWeeklySpend = weekLlm
      .filter((r) => r.provider === "claude")
      .reduce((sum, r) => sum + r.cost, 0);

    // Gemini counts — we return all Gemini entries so the client can filter
    // by Pacific timezone for RPD quota tracking
    const geminiDailyCount = todayLlm.filter(
      (r) => r.provider === "gemini"
    ).length;

    // Also return Gemini entries with timestamps so client can do Pacific-day filtering
    const geminiEntries = weekLlm
      .filter((r) => r.provider === "gemini")
      .map((r) => ({ timestamp: r.timestamp }));

    return {
      dailyGenSpend,
      dailyGenCount,
      weeklyGenSpend,
      claudeDailySpend,
      claudeDailyCount,
      claudeWeeklySpend,
      geminiDailyCount,
      geminiEntries,
    };
  },
});

/** Get today's entries for server-side cost checks */
export const getDailySummary = query({
  handler: async (ctx) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString();

    const rows = await ctx.db
      .query("costLog")
      .withIndex("by_timestamp")
      .collect();

    const todayRows = rows.filter((r) => r.timestamp >= todayStr);

    const generationSpend = todayRows
      .filter((r) => r.entryType === "generation")
      .reduce((sum, r) => sum + r.cost, 0);

    const generationCount = todayRows.filter(
      (r) => r.entryType === "generation"
    ).length;

    const llmEntries = todayRows.filter((r) => r.entryType === "llm");

    const igPublishCount = todayRows.filter(
      (r) => r.entryType === "ig_publish"
    ).length;

    return {
      generationSpend,
      generationCount,
      igPublishCount,
      llmEntries: llmEntries.map((e) => ({
        timestamp: e.timestamp,
        provider: e.provider,
        callType: e.callType,
        cost: e.cost,
        inputTokens: e.inputTokens,
        outputTokens: e.outputTokens,
        model: e.model,
      })),
    };
  },
});
