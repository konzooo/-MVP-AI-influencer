import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/** Admin: list all users (for debugging) */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("users").collect();
  },
});

/** Admin: list auth accounts (for debugging) */
export const listAuthAccounts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("authAccounts").collect();
  },
});

/** Admin: delete a specific user by _id */
export const deleteUserById = mutation({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    // Delete auth accounts
    const accounts = await ctx.db
      .query("authAccounts")
      .withIndex("userIdAndProvider", (q) => q.eq("userId", userId))
      .collect();
    for (const account of accounts) {
      await ctx.db.delete(account._id);
    }

    // Delete auth sessions
    const sessions = await ctx.db
      .query("authSessions")
      .withIndex("userId", (q) => q.eq("userId", userId))
      .collect();
    for (const session of sessions) {
      // Delete refresh tokens for this session
      const tokens = await ctx.db
        .query("authRefreshTokens")
        .withIndex("sessionId", (q) => q.eq("sessionId", session._id))
        .collect();
      for (const token of tokens) {
        await ctx.db.delete(token._id);
      }
      await ctx.db.delete(session._id);
    }

    await ctx.db.delete(userId);
    return { deleted: true, accounts: accounts.length };
  },
});
