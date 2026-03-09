"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

// ─── Generate Action ──────────────────────────────────────────────────────────
// Wraps FAL.ai Seedream generation for use in Convex actions

export const run = action({
  args: {
    prompt: v.string(),
    imageUrls: v.array(v.string()),
    imageSize: v.optional(v.string()),
    numImages: v.optional(v.number()),
    seed: v.optional(v.number()),
    enableSafetyChecker: v.optional(v.boolean()),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) throw new Error("FAL_KEY not configured");

    const { prompt, imageUrls, imageSize, numImages, seed, enableSafetyChecker } = args;

    if (!prompt) throw new Error("Prompt is required");
    if (!imageUrls || imageUrls.length === 0) {
      throw new Error("At least one reference image is required for Seedream 4.5");
    }

    return await generateWithSeedream({
      prompt,
      imageUrls,
      imageSize: imageSize || "square_hd",
      numImages: numImages || 1,
      seed,
      enableSafetyChecker: enableSafetyChecker ?? true,
      apiKey,
    });
  },
});

// ─── Upload action ────────────────────────────────────────────────────────────
// Uploads a base64 data URI to FAL storage and returns a public URL

export const uploadToFalStorage = action({
  args: {
    fileData: v.string(), // base64 data URI
  },
  handler: async (_ctx, { fileData }) => {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) throw new Error("FAL_KEY not configured");
    return await uploadBase64ToFal(fileData, apiKey);
  },
});

// ─── Implementation ───────────────────────────────────────────────────────────

async function generateWithSeedream(params: {
  prompt: string;
  imageUrls: string[];
  imageSize: string;
  numImages: number;
  seed?: number;
  enableSafetyChecker: boolean;
  apiKey: string;
}) {
  const { prompt, imageUrls, imageSize, numImages, seed, enableSafetyChecker, apiKey } = params;

  // Use FAL REST API directly (no SDK — avoids bundling issues in Convex)
  const submitRes = await fetch("https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit", {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      image_urls: imageUrls,
      image_size: imageSize,
      num_images: numImages,
      max_images: numImages,
      ...(seed ? { seed } : {}),
      enable_safety_checker: enableSafetyChecker,
    }),
  });

  if (!submitRes.ok) {
    const err = await submitRes.text();
    throw new Error(`FAL submit error: ${submitRes.status} - ${err}`);
  }

  const { request_id } = await submitRes.json();

  // Poll for completion
  const maxAttempts = 120; // 2 minutes max
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(1000);

    const statusRes = await fetch(
      `https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests/${request_id}/status`,
      { headers: { "Authorization": `Key ${apiKey}` } }
    );

    if (!statusRes.ok) continue;
    const status = await statusRes.json();

    if (status.status === "COMPLETED") {
      const resultRes = await fetch(
        `https://queue.fal.run/fal-ai/bytedance/seedream/v4.5/edit/requests/${request_id}`,
        { headers: { "Authorization": `Key ${apiKey}` } }
      );
      if (!resultRes.ok) throw new Error("Failed to fetch generation result");
      const result = await resultRes.json();
      return result as { images: { url: string; width?: number; height?: number }[] };
    }

    if (status.status === "FAILED") {
      throw new Error(`FAL generation failed: ${JSON.stringify(status.error)}`);
    }
  }

  throw new Error("FAL generation timed out after 2 minutes");
}

async function uploadBase64ToFal(fileData: string, apiKey: string): Promise<string> {
  const match = fileData.match(/^data:(.+?);base64,(.+)$/);
  if (!match) throw new Error("Invalid data URI format");

  const mimeType = match[1];
  const base64 = match[2];

  // Convert base64 to binary
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Upload to FAL storage
  const uploadRes = await fetch("https://rest.alpha.fal.ai/storage/upload/initiate", {
    method: "POST",
    headers: {
      "Authorization": `Key ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file_name: `upload.${mimeType.split("/")[1] || "jpg"}`, content_type: mimeType }),
  });

  if (!uploadRes.ok) {
    // Fallback: return the data URI as-is
    console.warn("[FAL upload] initiate failed, returning data URI");
    return fileData;
  }

  const { upload_url, file_url } = await uploadRes.json();

  const putRes = await fetch(upload_url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: bytes,
  });

  if (!putRes.ok) {
    console.warn("[FAL upload] PUT failed, returning data URI");
    return fileData;
  }

  return file_url;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
