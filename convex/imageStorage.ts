import { v } from "convex/values";
import {
  mutation,
  query,
  action,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

export const generateUploadUrl = mutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

// Internal versions for use from actions (avoids circular type reference)
export const internalGenerateUploadUrl = internalMutation({
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});

export const internalGetUrl = internalQuery({
  args: { storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    return await ctx.storage.getUrl(args.storageId);
  },
});

/**
 * Action: fetches an image from a FAL URL, uploads it to Convex storage,
 * and returns the permanent storage ID + URL.
 */
export const persistFalImage = action({
  args: {
    falUrl: v.string(),
    postId: v.optional(v.string()),
    prompt: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ storageId: string; url: string | null }> => {
    // Fetch the image from FAL
    const response = await fetch(args.falUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch FAL image: ${response.status}`);
    }

    const blob = await response.blob();

    // Upload to Convex storage via internal mutation
    const uploadUrl = await ctx.runMutation(
      internal.imageStorage.internalGenerateUploadUrl
    );
    const uploadResponse = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": blob.type || "image/png" },
      body: blob,
    });

    if (!uploadResponse.ok) {
      throw new Error(
        `Failed to upload to Convex storage: ${uploadResponse.status}`
      );
    }

    const { storageId } = (await uploadResponse.json()) as {
      storageId: string;
    };

    // Get the permanent URL via internal query
    const url = await ctx.runQuery(internal.imageStorage.internalGetUrl, {
      storageId: storageId as Id<"_storage">,
    });

    return { storageId, url };
  },
});
