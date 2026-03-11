/**
 * One-time migration script: Compress reference images and upload to Convex storage.
 * Run with: npx ts-node scripts/migrate-reference-images.ts
 *
 * Reads from: /Users/kons/Documents/Side/Images/<alba_ai0>/{Original Training Data set,Improved Set}
 * Compresses to: /Users/kons/Documents/Side/Images/compressed_images/
 * Uploads to: Convex storage + referenceImages table
 */

import { readdir, readFile, writeFile, mkdir, stat } from "fs/promises";
import { join, basename, extname } from "path";
import sharp from "sharp";
import { ConvexHttpClient } from "convex/browser";

const REFERENCE_LIBRARY_ROOT = "/Users/kons/Documents/Side/Images/<alba_ai0>";
const COMPRESSED_IMAGES_DIR = "/Users/kons/Documents/Side/Images/compressed_images";

const SOURCES = [
  {
    key: "original",
    path: join(REFERENCE_LIBRARY_ROOT, "Original Training Data set"),
  },
  { key: "improved", path: join(REFERENCE_LIBRARY_ROOT, "Improved Set") },
];

const MAIN_IMAGE_MAX_WIDTH = 1080;
const MAIN_IMAGE_QUALITY = 80;
const THUMBNAIL_WIDTH = 300;
const THUMBNAIL_QUALITY = 75;

interface ReferenceImageMetadata {
  schema_version: string;
  indoor_outdoor: "indoor" | "outdoor" | "unknown";
  place: { type: string; detail: string };
  capture_method: "mirror_selfie" | "front_selfie" | "non_selfie";
  framing: "closeup" | "chest_up" | "waist_up" | "full_body";
  expression: {
    type: "smile" | "neutral" | "laugh" | "serious" | "other";
    mouth: "open" | "closed";
    detail: string;
  };
  time_of_day: "day" | "night" | "golden_hour" | "blue_hour" | "unknown";
  image_style: { color: "color" | "bw"; detail: string };
}

interface ParsedMetadata {
  summary?: string;
  tags?: string[];
  metadata?: Partial<ReferenceImageMetadata>;
}

function parseMetadataFile(content: string): ParsedMetadata {
  try {
    return JSON.parse(content);
  } catch {
    return {};
  }
}

async function uploadToConvex(
  client: ConvexHttpClient,
  buffer: Buffer,
  contentType: string
): Promise<string> {
  // Get upload URL from Convex (generateUploadUrl is a mutation)
  const uploadUrl = await client.mutation(
    "imageStorage:generateUploadUrl" as any
  );

  // Upload to storage
  const uploadResponse = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: buffer as unknown as BodyInit,
  });

  if (!uploadResponse.ok) {
    throw new Error(
      `Failed to upload to Convex storage: ${uploadResponse.status}`
    );
  }

  const { storageId } = (await uploadResponse.json()) as {
    storageId: string;
  };
  return storageId;
}

async function compressImage(
  buffer: Buffer,
  maxWidth: number,
  quality: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(maxWidth, maxWidth, { fit: "inside", withoutEnlargement: true })
    .webp({ quality })
    .toBuffer();
}

async function migrationReferenceImages() {
  // Initialize Convex client
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (!convexUrl) {
    throw new Error("NEXT_PUBLIC_CONVEX_URL env var not set");
  }
  const client = new ConvexHttpClient(convexUrl);

  // Ensure compressed images directory exists
  try {
    await stat(COMPRESSED_IMAGES_DIR);
  } catch {
    await mkdir(COMPRESSED_IMAGES_DIR, { recursive: true });
  }

  let totalMigrated = 0;

  for (const source of SOURCES) {
    console.log(`\n📁 Processing source: ${source.key}`);

    let files: string[] = [];
    try {
      files = await readdir(source.path);
    } catch {
      console.warn(`  ⚠️  Source directory not found: ${source.path}`);
      continue;
    }

    const imageFiles = files.filter((f) =>
      /\.(jpg|jpeg|png|webp)$/i.test(f)
    );
    console.log(`  Found ${imageFiles.length} images`);

    for (const filename of imageFiles) {
      try {
        const filePath = join(source.path, filename);
        const metadataPath = filePath.replace(
          /\.(jpg|jpeg|png|webp)$/i,
          ".txt"
        );

        // Read image
        const imageBuffer = await readFile(filePath);

        // Read metadata
        let summary = filename;
        let tags: string[] = [source.key];
        let metadata: Partial<ReferenceImageMetadata> = {
          schema_version: "1.0",
          indoor_outdoor: "unknown",
          place: { type: "unknown", detail: "unknown" },
          capture_method: "non_selfie",
          framing: "waist_up",
          expression: {
            type: "neutral",
            mouth: "closed",
            detail: "unknown",
          },
          time_of_day: "unknown",
          image_style: { color: "color", detail: "unknown" },
        };

        try {
          const metadataContent = await readFile(metadataPath, "utf-8");
          const parsed = parseMetadataFile(metadataContent);
          summary = parsed.summary || summary;
          tags = parsed.tags || tags;
          metadata = { ...metadata, ...parsed.metadata };
        } catch {
          // Metadata file doesn't exist, use defaults
        }

        // Compress images
        const mainBuffer = await compressImage(
          imageBuffer,
          MAIN_IMAGE_MAX_WIDTH,
          MAIN_IMAGE_QUALITY
        );
        const thumbnailBuffer = await compressImage(
          imageBuffer,
          THUMBNAIL_WIDTH,
          THUMBNAIL_QUALITY
        );

        // Save locally
        const basename_noext = basename(filename, extname(filename));
        const localMainPath = join(
          COMPRESSED_IMAGES_DIR,
          `${basename_noext}_main.webp`
        );
        const localThumbPath = join(
          COMPRESSED_IMAGES_DIR,
          `${basename_noext}_thumb.webp`
        );
        await writeFile(localMainPath, mainBuffer);
        await writeFile(localThumbPath, thumbnailBuffer);

        // Upload to Convex
        const mainStorageId = await uploadToConvex(
          client,
          mainBuffer,
          "image/webp"
        );
        const thumbStorageId = await uploadToConvex(
          client,
          thumbnailBuffer,
          "image/webp"
        );

        // Save to Convex DB
        const imageId = `ref-${source.key}-${basename_noext}`;
        await client.mutation("referenceImages:add" as any, {
          imageId,
          sourceKey: source.key,
          filename,
          storageId: mainStorageId,
          thumbnailStorageId: thumbStorageId,
          summary,
          tags,
          metadata: JSON.stringify(metadata),
          createdAt: new Date().toISOString(),
        });

        totalMigrated++;
        console.log(`  ✓ ${filename} (${mainBuffer.length} bytes)`);
      } catch (error) {
        console.error(
          `  ✗ Failed to migrate ${filename}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
  }

  console.log(`\n✅ Migration complete! Migrated ${totalMigrated} images.`);
  console.log(`📦 Compressed versions saved to: ${COMPRESSED_IMAGES_DIR}`);
}

migrationReferenceImages().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
