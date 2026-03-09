"use node";

/**
 * Convex action: download an image from a temporary URL (e.g. FAL.ai CDN)
 * and store it permanently in Convex file storage.
 *
 * FAL.ai generated image URLs expire after 7 days.
 * Calling persistImage() immediately after generation gives permanent URLs.
 */

import { action, internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public action — called from the browser after client-side generation.
 * Downloads the given URL and uploads to Convex storage.
 * Returns the permanent storageId and the URL to access the file.
 */
export const persistImage = action({
  args: {
    url: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, { url, mimeType }): Promise<{ storageId: string; permanentUrl: string }> => {
    return await downloadAndStore(ctx, url, mimeType || "image/jpeg");
  },
});

/**
 * Internal action — called from the task runner after server-side generation.
 */
export const persistImageInternal = internalAction({
  args: {
    url: v.string(),
    mimeType: v.optional(v.string()),
  },
  handler: async (ctx, { url, mimeType }): Promise<{ storageId: string; permanentUrl: string }> => {
    return await downloadAndStore(ctx, url, mimeType || "image/jpeg");
  },
});

// ─── Shared implementation ─────────────────────────────────────────────────────

async function downloadAndStore(
  ctx: any,
  url: string,
  mimeType: string
): Promise<{ storageId: string; permanentUrl: string }> {
  // Skip if already a Convex storage URL
  if (url.includes(".convex.cloud/api/storage/")) {
    return { storageId: "", permanentUrl: url };
  }

  // Download the image
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const actualMimeType = blob.type || mimeType;

  // Get upload URL from Convex storage
  const uploadUrl = await ctx.storage.generateUploadUrl();

  // Upload to Convex storage
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": actualMimeType },
    body: blob,
  });

  if (!uploadResponse.ok) {
    throw new Error(`Failed to upload to Convex storage: ${uploadResponse.status}`);
  }

  const { storageId } = await uploadResponse.json();

  // Get the permanent URL
  const permanentUrl = await ctx.storage.getUrl(storageId);
  if (!permanentUrl) {
    throw new Error("Failed to get permanent URL from Convex storage");
  }

  return { storageId, permanentUrl };
}
