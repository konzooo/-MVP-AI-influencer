import { NextRequest, NextResponse } from "next/server";
import { uploadToFalStorage } from "@/lib/fal";
import {
  normalizeDataUriForReference,
  normalizeImageBufferForReference,
} from "@/lib/reference-image-library";

async function normalizeUploadSource(
  request: NextRequest,
  payload: { dataUri?: string; src?: string }
): Promise<string> {
  if (payload.dataUri) {
    return normalizeDataUriForReference(payload.dataUri);
  }

  if (!payload.src) {
    throw new Error("dataUri or src is required");
  }

  const sourceUrl = payload.src.startsWith("http://") || payload.src.startsWith("https://")
    ? payload.src
    : payload.src.startsWith("/")
      ? new URL(payload.src, request.nextUrl.origin).toString()
      : null;

  if (!sourceUrl) {
    throw new Error("Unsupported upload source");
  }

  const response = await fetch(sourceUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch upload source: ${response.status}`);
  }

  const sourceBuffer = Buffer.from(await response.arrayBuffer());
  const isReferenceSizedLibraryAsset =
    sourceUrl.includes("/api/reference-images/source/") &&
    sourceUrl.includes("variant=reference");

  if (isReferenceSizedLibraryAsset) {
    return `data:${response.headers.get("content-type") || "image/jpeg"};base64,${sourceBuffer.toString("base64")}`;
  }

  const normalized = await normalizeImageBufferForReference(sourceBuffer);

  return `data:image/jpeg;base64,${normalized.toString("base64")}`;
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.FAL_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "FAL_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as { dataUri?: string; src?: string };
    const normalizedDataUri = await normalizeUploadSource(request, body);

    const url = await uploadToFalStorage(normalizedDataUri, apiKey);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
