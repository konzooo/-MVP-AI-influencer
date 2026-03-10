/**
 * Local migration script — runs on your Mac, uploads local images to Convex.
 *
 * Usage:
 *   node scripts/migrate-reference-images.mjs
 *
 * Requires: npx convex dev running (or use prod URL with --prod flag)
 */

import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { readFileSync } from "fs";
import { execSync } from "child_process";

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

const isProd = process.argv.includes("--prod");
const CONVEX_URL = isProd
  ? "https://blissful-dogfish-708.convex.cloud"
  : env.NEXT_PUBLIC_CONVEX_URL;
const IMAGES_PATH = "/Users/kons/Documents/Side/Images/<alba_ai0>/Improved Set";

// Your Convex user ID — get this from Convex dashboard > Auth > Users
// or run: npx convex run admin:listUsers (if you have that function)
const USER_ID = env.CONVEX_MIGRATION_USER_ID || process.env.USER_ID;

if (!CONVEX_URL) {
  console.error("Missing NEXT_PUBLIC_CONVEX_URL in .env.local");
  process.exit(1);
}

if (!USER_ID) {
  console.error(
    "Missing USER_ID. Set CONVEX_MIGRATION_USER_ID in .env.local or pass as USER_ID=xxx node scripts/migrate-reference-images.mjs"
  );
  process.exit(1);
}

function parseMetadataFile(content) {
  const lines = content.split("\n");
  const summaryLine = lines.find((l) => l.startsWith("# summary:"));
  const tagsLine = lines.find((l) => l.startsWith("# tags:"));
  const jsonStart = lines.findIndex((l) => l.trim() === "---JSON---");
  const jsonEnd = lines.findIndex((l) => l.trim() === "---END---");

  const summary = summaryLine ? summaryLine.replace("# summary:", "").trim() : "";
  const tagsStr = tagsLine ? tagsLine.replace("# tags:", "").trim() : "";
  const tags = tagsStr ? tagsStr.split(",").map((t) => t.trim()).filter(Boolean) : [];

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
      place: { type: "unknown", detail: "" },
      capture_method: "non_selfie",
      framing: "waist_up",
      expression: { type: "neutral", mouth: "closed", detail: "" },
      time_of_day: "day",
      image_style: { color: "color", detail: "" },
    };
  }

  return { summary, tags, metadata };
}

async function getUploadUrl(prod = false) {
  const prodFlag = prod ? " --prod" : "";
  const result = execSync(
    `npx convex run referenceImages:internalGenerateUploadUrl '{}'${prodFlag}`,
    { encoding: "utf-8" }
  ).trim();
  return JSON.parse(result);
}

async function main() {
  console.log("Connecting to Convex:", CONVEX_URL);
  console.log("Migrating from:", IMAGES_PATH);
  console.log("User ID:", USER_ID);
  console.log("");

  const files = await readdir(IMAGES_PATH);
  const imageFiles = files.filter((f) => /\.(png|jpg|jpeg)$/i.test(f)).sort();

  console.log(`Found ${imageFiles.length} images\n`);

  let ok = 0,
    skipped = 0,
    errors = 0;

  for (const imageFile of imageFiles) {
    const baseName = imageFile.replace(/\.(png|jpg|jpeg)$/i, "");
    const txtFile = `${baseName}.txt`;

    if (!files.includes(txtFile)) {
      console.log(`  SKIP ${imageFile} — no metadata file`);
      skipped++;
      continue;
    }

    process.stdout.write(`  ${imageFile}... `);

    try {
      // Read image
      const imageBuffer = await readFile(join(IMAGES_PATH, imageFile));
      const mimeType = imageFile.toLowerCase().endsWith(".png")
        ? "image/png"
        : "image/jpeg";

      // Parse metadata
      const txtContent = await readFile(join(IMAGES_PATH, txtFile), "utf-8");
      const { summary, tags, metadata } = parseMetadataFile(txtContent);

      // Get upload URL via internal mutation
      const uploadUrl = await getUploadUrl(isProd);

      // Upload image to Convex storage
      const uploadRes = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": mimeType },
        body: imageBuffer,
      });

      if (!uploadRes.ok) throw new Error(`Upload failed: ${uploadRes.status}`);
      const { storageId } = await uploadRes.json();

      // Create DB record via internal mutation
      const argsJson = JSON.stringify({
        userId: USER_ID,
        filename: imageFile,
        storageId,
        summary,
        tags,
        metadata,
      });

      const prodFlag = isProd ? " --prod" : "";
      execSync(
        `npx convex run referenceImages:internalCreate '${argsJson.replace(/'/g, "'\\''")}'${prodFlag}`,
        { encoding: "utf-8" }
      );

      process.stdout.write(`✓\n`);
      ok++;
    } catch (err) {
      process.stdout.write(`✗ ${err.message}\n`);
      errors++;
    }
  }

  console.log(`\nDone: ${ok} migrated, ${skipped} skipped, ${errors} errors`);
}

main().catch(console.error);
