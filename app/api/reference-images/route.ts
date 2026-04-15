import { NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import { loadReferenceImages } from "@/lib/reference-image-library";
import { buildConvexReferenceImageUrl } from "@/lib/reference-image-storage";
import type { ReferenceImage } from "@/lib/types";

const DEFAULT_METADATA = {
  schema_version: "1.0",
  indoor_outdoor: "unknown" as const,
  place: { type: "unknown", detail: "unknown" },
  capture_method: "non_selfie" as const,
  framing: "waist_up" as const,
  expression: { type: "neutral" as const, mouth: "closed" as const, detail: "unknown" },
  time_of_day: "unknown" as const,
  image_style: { color: "color" as const, detail: "unknown" },
};

export async function GET() {
  // Try Convex first
  const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
  if (convexUrl) {
    try {
      const client = new ConvexHttpClient(convexUrl);
      const rows = await client.query(api.referenceImages.list);

      if (rows.length > 0) {
        const images: ReferenceImage[] = rows.map((row) => {
          let metadata = DEFAULT_METADATA;
          try {
            const parsed = JSON.parse(row.metadata);
            metadata = { ...DEFAULT_METADATA, ...parsed };
          } catch {
            // Use defaults
          }

          const referenceUrl = buildConvexReferenceImageUrl(
            row.imageId,
            "reference",
            row.storageId
          );
          const thumbnailUrl = buildConvexReferenceImageUrl(
            row.imageId,
            "thumbnail",
            row.thumbnailStorageId ?? row.storageId
          );

          return {
            id: row.imageId,
            sourceKey: row.sourceKey as ReferenceImage["sourceKey"],
            filename: row.filename,
            imagePath: referenceUrl,
            originalPath: referenceUrl,
            referencePath: referenceUrl,
            thumbnailPath: thumbnailUrl,
            summary: row.summary,
            tags: row.tags,
            metadata,
            createdAt: row.createdAt,
          };
        });

        return NextResponse.json(
          { images, total: images.length },
          {
            headers: {
              "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
            },
          }
        );
      }
    } catch (error) {
      console.error(
        "[/api/reference-images] Convex query failed, falling back to filesystem:",
        error
      );
    }
  }

  // Fallback: filesystem (pre-migration)
  try {
    const images = await loadReferenceImages();
    return NextResponse.json(
      { images, total: images.length },
      {
        headers: {
          "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Failed to load reference images:", error);
    return NextResponse.json(
      { error: "Failed to load reference images" },
      { status: 500 }
    );
  }
}
