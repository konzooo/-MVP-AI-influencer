"use node";

/**
 * One-time migration: uploads local reference images to Convex storage.
 *
 * Run via:
 *   npx convex run migrations/migrateReferenceImages:run --no-push
 *
 * Or after deploying:
 *   npx convex run migrations/migrateReferenceImages:run
 */

import { internalAction } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";
import { readdir, readFile } from "fs/promises";
import { join } from "path";

const IMAGES_PATH = "/Users/kons/Documents/Side/Images/<alba_ai0>/Training Data set";

function parseMetadataFile(content: string) {
  const lines = content.split("\n");
  const summaryLine = lines.find((l) => l.startsWith("# summary:"));
  const tagsLine = lines.find((l) => l.startsWith("# tags:"));
  const jsonStart = lines.findIndex((l) => l === "---JSON---");
  const jsonEnd = lines.findIndex((l) => l === "---END---");

  const summary = summaryLine ? summaryLine.replace("# summary: ", "").trim() : "";
  const tagsStr = tagsLine ? tagsLine.replace("# tags: ", "").trim() : "";
  const tags = tagsStr ? tagsStr.split(", ").map((t: string) => t.trim()) : [];

  let metadata: any = null;
  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      metadata = JSON.parse(lines.slice(jsonStart + 1, jsonEnd).join("\n"));
    } catch {
      // use defaults
    }
  }

  if (!metadata) {
    metadata = {
      schema_version: "1.0",
      indoor_outdoor: "indoor",
      place: { type: "unknown", detail: "unknown" },
      capture_method: "non_selfie",
      framing: "waist_up",
      expression: { type: "neutral", mouth: "closed", detail: "unknown" },
      time_of_day: "day",
      image_style: { color: "color", detail: "unknown" },
    };
  }

  return { summary, tags, metadata };
}

export const run = internalAction({
  args: {
    userId: v.id("users"),
  },
  handler: async (ctx, { userId }) => {
    const results: { file: string; status: string; message?: string }[] = [];

    const files = await readdir(IMAGES_PATH);
    const imageFiles = files.filter((f: string) => f.match(/\.(png|jpg|jpeg)$/i)).sort();

    console.log(`[Migration] Found ${imageFiles.length} images`);

    for (const imageFile of imageFiles) {
      const baseName = imageFile.replace(/\.(png|jpg|jpeg)$/i, "");
      const txtFile = `${baseName}.txt`;

      if (!files.includes(txtFile)) {
        results.push({ file: imageFile, status: "skip", message: "No metadata file" });
        continue;
      }

      try {
        // Read image
        const imageBuffer = await readFile(join(IMAGES_PATH, imageFile));
        const mimeType = imageFile.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

        // Parse metadata
        const txtContent = await readFile(join(IMAGES_PATH, txtFile), "utf-8");
        const { summary, tags, metadata } = parseMetadataFile(txtContent);

        // Get upload URL
        const uploadUrl = await ctx.storage.generateUploadUrl();

        // Upload image
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: imageBuffer,
        });

        if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
        const { storageId } = await uploadRes.json();

        // Create DB record (internal mutation skips auth)
        await ctx.runMutation(internal.referenceImages.internalCreate, {
          userId,
          filename: imageFile,
          storageId,
          summary,
          tags,
          metadata,
        });

        console.log(`[Migration] ✓ ${imageFile}`);
        results.push({ file: imageFile, status: "ok" });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error(`[Migration] ✗ ${imageFile}: ${msg}`);
        results.push({ file: imageFile, status: "error", message: msg });
      }
    }

    const ok = results.filter((r) => r.status === "ok").length;
    const skipped = results.filter((r) => r.status === "skip").length;
    const errors = results.filter((r) => r.status === "error").length;

    console.log(`[Migration] Done: ${ok} migrated, ${skipped} skipped, ${errors} errors`);
    return { ok, skipped, errors, results };
  },
});
