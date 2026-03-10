import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const DEFAULT_GUIDES = {
  captionStyle: `You write short, punchy Instagram captions that feel effortless and real. Key principles:
- MAX 2 lines — short is the style, not a limitation
- Witty, a little poetic, never over-explained
- Let the image carry the story; the caption adds a spark
- No filler: avoid "Embracing the moment", "Living my best life", "Grateful for..."
- Emojis optional, max 1, only if it genuinely fits
- No questions or calls-to-action unless the user specifically asks`,

  promptStyle: `You refine image generation prompts to be specific and atmospheric. Key principles:
- Include specific pose, expression, and body language
- Describe lighting quality and time of day
- Reference composition and framing
- Use descriptive adjectives for mood/style
- Mention fabrics, textures, and colors
- Keep it concise but evocative
- Use reference markers (Figure 1, Figure 2) when comparing to reference images`,
};

export const get = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return DEFAULT_GUIDES;

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (!settings || !settings.aiGuides) return DEFAULT_GUIDES;

    return settings.aiGuides;
  },
});

export const save = mutation({
  args: {
    captionStyle: v.string(),
    promptStyle: v.string(),
  },
  handler: async (ctx, { captionStyle, promptStyle }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    const aiGuides = { captionStyle, promptStyle };

    if (settings) {
      await ctx.db.patch(settings._id, { aiGuides });
    } else {
      await ctx.db.insert("settings", {
        userId,
        aiGuides,
      });
    }

    return aiGuides;
  },
});

export const reset = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const settings = await ctx.db
      .query("settings")
      .withIndex("by_userId", (q) => q.eq("userId", userId))
      .first();

    if (settings) {
      await ctx.db.patch(settings._id, { aiGuides: undefined });
    }

    return DEFAULT_GUIDES;
  },
});
