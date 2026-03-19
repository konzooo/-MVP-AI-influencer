import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-client";
import type { ReferenceImage, ReferenceImageMetadata } from "@/lib/types";
import { buildGeneratedImageUrl } from "@/lib/generated-image-storage";
import { persistGeneratedImageFromFal } from "@/lib/generated-image-storage";

const GENERATED_IMAGE_METADATA: ReferenceImageMetadata = {
  schema_version: "1.0",
  indoor_outdoor: "unknown",
  place: { type: "generated", detail: "fal.ai" },
  capture_method: "non_selfie",
  framing: "waist_up",
  expression: { type: "other", mouth: "closed", detail: "ai_generated" },
  time_of_day: "unknown",
  image_style: { color: "color", detail: "ai_generated" },
};

function buildTags(prompt: string, postTitle?: string): string[] {
  const promptWords = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .slice(0, 6);

  const titleWords = (postTitle || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .slice(0, 4);

  return Array.from(new Set(["generated", "fal_ai", ...titleWords, ...promptWords]));
}

function formatGeneratedFilename(createdAt: string, id: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? createdAt.replace(/[^0-9]/g, "").slice(0, 14)
    : [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
        String(date.getHours()).padStart(2, "0"),
        String(date.getMinutes()).padStart(2, "0"),
        String(date.getSeconds()).padStart(2, "0"),
      ].join("");

  return `generated_${stamp}_${id.slice(0, 8)}.png`;
}

export async function GET() {
  try {
    const client = getConvexClient();
    const rows = await client.query(api.generatedImages.list, {});

    const images: ReferenceImage[] = rows.map((row) => {
      const imagePath = buildGeneratedImageUrl(row.imageId);
      return {
        id: row.imageId,
        sourceKey: "generated",
        filename: formatGeneratedFilename(row.createdAt, row.imageId),
        imagePath,
        originalPath: imagePath,
        referencePath: imagePath,
        thumbnailPath: imagePath,
        summary: row.prompt || "Saved fal.ai output",
        tags: buildTags(row.prompt || "", row.postTitle),
        metadata: GENERATED_IMAGE_METADATA,
        createdAt: row.createdAt,
        librarySource: "generated",
      };
    });

    return NextResponse.json({ images, total: images.length });
  } catch (error) {
    console.error("Failed to load generated images:", error);
    return NextResponse.json(
      { error: "Failed to load generated images" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      images?: Array<{
        imageId?: string;
        falUrl?: string;
        prompt?: string;
        postId?: string;
        postTitle?: string;
        promptIndex?: number;
        createdAt?: string;
      }>;
    };

    const images = Array.isArray(body.images) ? body.images : [];
    let imported = 0;

    for (const image of images) {
      if (!image.falUrl || !image.prompt) continue;
      await persistGeneratedImageFromFal({
        imageId: image.imageId || crypto.randomUUID(),
        falUrl: image.falUrl,
        prompt: image.prompt,
        postId: image.postId,
        postTitle: image.postTitle,
        promptIndex: image.promptIndex,
        createdAt: image.createdAt || new Date().toISOString(),
      });
      imported += 1;
    }

    return NextResponse.json({ imported });
  } catch (error) {
    console.error("Failed to import generated images:", error);
    return NextResponse.json(
      { error: "Failed to import generated images" },
      { status: 500 }
    );
  }
}
