import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Get all settings for current user ───────────────────────────────────────

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("settings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

// ─── Save identity (persona) ──────────────────────────────────────────────────

export const saveIdentity = mutation({
  args: { identity: v.any() },
  handler: async (ctx, { identity }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await upsertSettings(ctx, userId, { identity });
  },
});

// ─── Save AI settings ─────────────────────────────────────────────────────────

export const saveAISettings = mutation({
  args: { aiSettings: v.any() },
  handler: async (ctx, { aiSettings }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await upsertSettings(ctx, userId, { aiSettings });
  },
});

// ─── Save cost settings ───────────────────────────────────────────────────────

export const saveCostSettings = mutation({
  args: { costSettings: v.any() },
  handler: async (ctx, { costSettings }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    await upsertSettings(ctx, userId, { costTracker: costSettings });
  },
});

// ─── Save all at once ─────────────────────────────────────────────────────────

export const saveAll = mutation({
  args: {
    identity: v.optional(v.any()),
    aiSettings: v.optional(v.any()),
    costSettings: v.optional(v.any()),
  },
  handler: async (ctx, { identity, aiSettings, costSettings }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");
    const patch: Record<string, any> = {};
    if (identity !== undefined) patch.identity = identity;
    if (aiSettings !== undefined) patch.aiSettings = aiSettings;
    if (costSettings !== undefined) patch.costTracker = costSettings;
    await upsertSettings(ctx, userId, patch);
  },
});

// ─── Helper ───────────────────────────────────────────────────────────────────

async function upsertSettings(ctx: any, userId: any, patch: Record<string, any>) {
  const existing = await ctx.db
    .query("settings")
    .withIndex("by_userId", (q: any) => q.eq("userId", userId))
    .unique();

  if (existing) {
    await ctx.db.patch(existing._id, patch);
  } else {
    await ctx.db.insert("settings", { userId, ...patch });
  }
}
