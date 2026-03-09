/**
 * Local migration script — runs on your Mac, uploads local images to Convex.
 *
 * Usage:
 *   node scripts/migrate-reference-images.mjs
 *
 * Requires npx convex dev to be running (or deployed).
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { createReadStream } from "fs";
import { ConvexHttpClient } from "convex/browser";
import { readFileSync } from "fs";

// Load env vars from .env.local manually
const envContent = readFileSync(".env.local", "utf-8");
const env = Object.fromEntries(
  envContent
    .split("\n")
    .filter((line) => line.includes("=") && !line.startsWith("#"))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const CONVEX_URL = env.NEXT_PUBLIC_CONVEX_URL;
const IMAGES_PATH = "/Users/kons/Documents/Side/Images/<alba_ai0>/Training Data set";
const USER_ID = "kh7d0vbjf1w992vsw3k5e63hc182h7r0"; // Active user from admin:listUsers

if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

function parseMetadataFile(content) {
  const lines = content.split("\n");
  const summaryLine = lines.find((l) => l.startsWith("# summary:"));
  const tagsLine = lines.find((l) => l.startsWith("# tags:"));
  const jsonStart = lines.findIndex((l) => l === "---JSON---");
  const jsonEnd = lines.findIndex((l) => l === "---END---");

  const summary = summaryLine ? summaryLine.replace("# summary: ", "").trim() : "";
  const tagsStr = tagsLine ? tagsLine.replace("# tags: ", "").trim() : "";
  const tags = tagsStr ? tagsStr.split(", ").map((t) => t.trim()) : [];

  let metadata = null;
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

async function main() {
  console.log("Connecting to Convex:", CONVEX_URL);
  const client = new ConvexHttpClient(CONVEX_URL);

  // We need to call internal mutations — use the Convex CLI approach
  // by calling via the HTTP API with deploy key
  const CONVEX_DEPLOY_KEY = env.CONVEX_DEPLOYMENT;

  // Check existing images
  // Since we can't call auth-gated queries without a token,
  // we'll just try to upload all and let internalCreate skip duplicates

  const files = await readdir(IMAGES_PATH);
  const imageFiles = files.filter((f) => f.match(/\.(png|jpg|jpeg)$/i)).sort();

  console.log(`Found ${imageFiles.length} images\n`);

  let ok = 0, skipped = 0, errors = 0;

  for (const imageFile of imageFiles) {
    const baseName = imageFile.replace(/\.(png|jpg|jpeg)$/i, "");
    const txtFile = `${baseName}.txt`;

    if (!files.includes(txtFile)) {
      console.log(`  SKIP ${imageFile} — no metadata`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${imageFile}... `);

    try {
      // Read image
      const imageBuffer = await readFile(join(IMAGES_PATH, imageFile));
      const mimeType = imageFile.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

      // Parse metadata
      const txtContent = await readFile(join(IMAGES_PATH, txtFile), "utf-8");
      const { summary, tags, metadata } = parseMetadataFile(txtContent);

      // Get upload URL — call the generateUploadUrl mutation via HTTP
      const uploadUrlRes = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "referenceImages:generateUploadUrl",
          args: {},
          format: "json",
        }),
      });

      if (!uploadUrlRes.ok) {
        const err = await uploadUrlRes.text();
        // generateUploadUrl requires auth — we need to call internalCreate differently
        console.log(`\n  AUTH required — see note below`);
        console.log(`  Error: ${err}`);
        break;
      }

      const { value: uploadUrl } = await uploadUrlRes.json();

      // Upload to Convex storage
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: imageBuffer,
      });

      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      const { storageId } = await uploadRes.json();

      // Call internal mutation via the Convex CLI JSON API
      const createRes = await fetch(`${CONVEX_URL}/api/mutation`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: "referenceImages:internalCreate",
          args: { userId: USER_ID, filename: imageFile, storageId, summary, tags, metadata },
          format: "json",
        }),
      });

      if (!createRes.ok) throw new Error(`Create failed: ${createRes.status}`);
      console.log(`✓`);
      ok++;
    } catch (err) {
      console.log(`✗ ${err.message}`);
      errors++;
    }
  }

  console.log(`\nDone: ${ok} migrated, ${skipped} skipped, ${errors} errors`);
}

main().catch(console.error);
