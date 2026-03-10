import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

const DEFAULT_GUIDES = {
  captionStyle: `You write Instagram captions in a personal, authentic voice that feels like a friend sharing a moment. Key principles:
- Start with a hook or genuine observation
- Keep it conversational, not corporate
- Show personality and vulnerability
- End with a question or call-to-action
- Use line breaks for readability
- Emojis are optional but can enhance mood`,

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
