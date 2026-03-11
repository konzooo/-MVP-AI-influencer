import { NextRequest, NextResponse } from "next/server";
import {
  isReferenceLibrarySourceKey,
  readReferenceImageAsset,
  updateReferenceImageMetadata,
} from "@/lib/reference-image-library";

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ sourceKey: string; filename: string }>;
  }
) {
  let sourceKey = "";
  let filename = "";

  try {
    const resolvedParams = await params;
    sourceKey = resolvedParams.sourceKey;
    filename = resolvedParams.filename;

    if (!isReferenceLibrarySourceKey(sourceKey)) {
      return new NextResponse("Image not found", { status: 404 });
    }

    const { buffer, contentType } = await readReferenceImageAsset(
      sourceKey,
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
    console.error(
      `Failed to serve reference image ${sourceKey}/${filename}:`,
      error
    );
    return new NextResponse("Image not found", { status: 404 });
  }
}

export async function PUT(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ sourceKey: string; filename: string }>;
  }
) {
  try {
    const resolvedParams = await params;
    const { sourceKey, filename } = resolvedParams;

    if (!isReferenceLibrarySourceKey(sourceKey)) {
      return NextResponse.json(
        { error: "Unknown reference image source" },
        { status: 404 }
      );
    }

    const data = await request.json();
    await updateReferenceImageMetadata(sourceKey, filename, data);

    return NextResponse.json({
      success: true,
      message: "Image metadata updated successfully",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update image metadata";
    console.error("Failed to update reference image metadata:", error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
