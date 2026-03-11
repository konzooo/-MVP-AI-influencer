import { NextRequest, NextResponse } from "next/server";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";
import {
  readReferenceImageAsset,
  updateReferenceImageMetadata,
} from "@/lib/reference-image-library";
import { extname, basename } from "path";

const LEGACY_SOURCE_KEY = "original";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  let filename = "";

  try {
    const resolvedParams = await params;
    filename = resolvedParams.filename;

    const { buffer, contentType } = await readReferenceImageAsset(
      LEGACY_SOURCE_KEY,
      filename,
      request.nextUrl.searchParams
    );

    return new NextResponse(buffer as unknown as BodyInit, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error(`Failed to serve legacy reference image ${filename}:`, error);
    return new NextResponse("Image not found", { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const resolvedParams = await params;
    const filename = resolvedParams.filename;
    const data = await request.json();

    // Try Convex first
    const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (convexUrl) {
      try {
        const client = new ConvexHttpClient(convexUrl);
        const filenameNoExt = basename(filename, extname(filename));
        const imageId = `ref-${filenameNoExt}`;
        await client.mutation(api.referenceImages.updateMetadata, {
          imageId,
          summary: data.summary,
          tags: data.tags,
          metadata: JSON.stringify(data.metadata),
        });
        return NextResponse.json({ success: true, message: "Image metadata updated successfully" });
      } catch (convexError) {
        console.warn("[PUT /api/reference-images] Convex update failed, falling back to filesystem:", convexError);
      }
    }

    // Fallback: filesystem
    await updateReferenceImageMetadata(LEGACY_SOURCE_KEY, filename, data);
    return NextResponse.json({ success: true, message: "Image metadata updated successfully" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update image metadata";
    console.error("Failed to update legacy reference image metadata:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
