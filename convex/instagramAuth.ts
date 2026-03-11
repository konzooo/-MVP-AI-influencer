import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const get = query({
  handler: async (ctx) => {
    const row = await ctx.db.query("instagramAuth").first();
    if (!row) return null;
    return {
      accessToken: row.accessToken,
      tokenExpiresAt: row.tokenExpiresAt,
      igUserId: row.igUserId,
      username: row.username,
      profilePictureUrl: row.profilePictureUrl,
      connectedAt: row.connectedAt,
    };
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
    // Delete existing row(s) — single-user app
    const existing = await ctx.db.query("instagramAuth").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
    await ctx.db.insert("instagramAuth", args);
  },
});

export const remove = mutation({
  handler: async (ctx) => {
    const existing = await ctx.db.query("instagramAuth").collect();
    for (const row of existing) {
      await ctx.db.delete(row._id);
    }
  },
});
