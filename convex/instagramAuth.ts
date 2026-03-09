import { mutation, query, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

// ─── Public queries/mutations (auth-gated) ────────────────────────────────────

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query("instagramAuth")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const save = mutation({
  args: {
    accessToken: v.string(),
    tokenExpiresAt: v.string(),
    igUserId: v.string(),
    username: v.string(),
    profilePictureUrl: v.string(),
    connectedAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("instagramAuth")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("instagramAuth", { userId, ...args });
    }
  },
});

export const remove = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("instagramAuth")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.delete(existing._id);
    }
  },
});

export const updateToken = mutation({
  args: {
    accessToken: v.string(),
    tokenExpiresAt: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("instagramAuth")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (!existing) throw new Error("No Instagram auth record found");
    await ctx.db.patch(existing._id, args);
  },
});

// ─── Internal (used by server-side task runner if needed) ─────────────────────

export const getByUserId = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query("instagramAuth")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();
  },
});

export const saveInternal = internalMutation({
  args: {
    userId: v.id("users"),
    accessToken: v.string(),
    tokenExpiresAt: v.string(),
    igUserId: v.string(),
    username: v.string(),
    profilePictureUrl: v.string(),
    connectedAt: v.string(),
  },
  handler: async (ctx, { userId, ...args }) => {
    const existing = await ctx.db
      .query("instagramAuth")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, args);
    } else {
      await ctx.db.insert("instagramAuth", { userId, ...args });
    }
  },
});
