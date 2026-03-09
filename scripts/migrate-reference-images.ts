/**
 * One-time migration script: upload local reference images to Convex storage.
 *
 * Usage:
 *   npx tsx scripts/migrate-reference-images.ts
 *
 * Requires:
 *   - CONVEX_URL env var (from .env.local)
 *   - CONVEX_DEPLOY_KEY or logged-in Convex CLI session
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import * as dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const IMAGES_PATH = "/Users/kons/Documents/Side/Images/<alba_ai0>/Training Data set";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

// ─── Parse .txt metadata file ─────────────────────────────────────────────────

function parseMetadataFile(content: string) {
  const lines = content.split("\n");
  const summaryLine = lines.find((l) => l.startsWith("# summary:"));
  const tagsLine = lines.find((l) => l.startsWith("# tags:"));
  const jsonStart = lines.findIndex((l) => l === "---JSON---");
  const jsonEnd = lines.findIndex((l) => l === "---END---");

  const summary = summaryLine ? summaryLine.replace("# summary: ", "").trim() : "";
  const tagsStr = tagsLine ? tagsLine.replace("# tags: ", "").trim() : "";
  const tags = tagsStr ? tagsStr.split(", ").map((t) => t.trim()) : [];

  let metadata: any = null;
  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      metadata = JSON.parse(lines.slice(jsonStart + 1, jsonEnd).join("\n"));
    } catch {
      console.warn("  Could not parse JSON metadata");
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

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("Connecting to Convex:", CONVEX_URL);

  // We need an auth token to call mutations. Since this is a personal app,
  // we'll use a simple approach: prompt user to paste their session token,
  // OR we use the Convex HTTP client with a deploy key if available.
  //
  // For simplicity, this script calls the API routes directly via Next.js
  // (which is running locally). The upload happens through the browser auth flow.
  //
  // Alternative approach: use internal mutations that bypass auth.
  // We'll use the internal migration mutation defined in convex/referenceImages.ts

  const client = new ConvexHttpClient(CONVEX_URL);

  // Read all files
  const files = await readdir(IMAGES_PATH);
  const imageFiles = files
    .filter((f) => f.match(/\.(png|jpg|jpeg)$/i))
    .sort();

  console.log(`Found ${imageFiles.length} images to migrate\n`);

  let migrated = 0;
  let skipped = 0;

  for (const imageFile of imageFiles) {
    const baseName = imageFile.replace(/\.(png|jpg|jpeg)$/i, "");
    const txtFile = `${baseName}.txt`;

    if (!files.includes(txtFile)) {
      console.log(`  SKIP ${imageFile} — no metadata file`);
      skipped++;
      continue;
    }

    console.log(`Migrating ${imageFile}...`);

    try {
      // 1. Read image file
      const imageBuffer = await readFile(join(IMAGES_PATH, imageFile));
      const mimeType = imageFile.endsWith(".png") ? "image/png" : "image/jpeg";

      // 2. Parse metadata
      const txtContent = await readFile(join(IMAGES_PATH, txtFile), "utf-8");
      const { summary, tags, metadata } = parseMetadataFile(txtContent);

      // 3. Get upload URL from Convex
      // Note: requires auth token in client. For migration, we'll call via fetch
      // using the Next.js API which has server-side auth context.
      const uploadUrlRes = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/reference-images/migrate-upload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: imageFile,
          mimeType,
          summary,
          tags,
          metadata,
          imageData: imageBuffer.toString("base64"),
        }),
      });

      if (!uploadUrlRes.ok) {
        const err = await uploadUrlRes.text();
        console.error(`  ERROR: ${err}`);
        skipped++;
        continue;
      }

      console.log(`  ✓ Migrated ${imageFile}`);
      migrated++;
    } catch (err) {
      console.error(`  ERROR migrating ${imageFile}:`, err);
      skipped++;
    }
  }

  console.log(`\nMigration complete: ${migrated} migrated, ${skipped} skipped`);
}

main().catch(console.error);
