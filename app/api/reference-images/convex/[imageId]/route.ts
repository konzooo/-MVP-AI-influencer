import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-client";

async function loadStoredReferenceImage(imageId: string, variant: string) {
  const client = getConvexClient();
  const row = await client.query(api.referenceImages.get, { imageId });

  if (!row) {
    throw new Error("Reference image not found");
  }

  const storageId =
    variant === "thumbnail" && row.thumbnailStorageId
      ? row.thumbnailStorageId
      : row.storageId;

  const upstreamUrl = await client.query(api.imageStorage.getUrl, {
    storageId,
  });

  if (!upstreamUrl) {
    throw new Error("Reference image URL not found");
  }

  const upstream = await fetch(upstreamUrl);
  if (!upstream.ok) {
    throw new Error(`Failed to fetch stored reference image: ${upstream.status}`);
  }

  return {
    contentType: upstream.headers.get("content-type") || "image/jpeg",
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

async function buildResponse(
  request: NextRequest,
  imageId: string,
  method: "GET" | "HEAD"
) {
  try {
    const variant = request.nextUrl.searchParams.get("variant") || "reference";
    const { contentType, buffer } = await loadStoredReferenceImage(imageId, variant);

    return new NextResponse(method === "HEAD" ? null : (buffer as unknown as BodyInit), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to serve reference image";
    return NextResponse.json({ error: message }, { status: 404 });
  }
}

export async function GET(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ imageId: string }>;
  }
) {
  const { imageId } = await params;
  return buildResponse(request, imageId, "GET");
}

export async function HEAD(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ imageId: string }>;
  }
) {
  const { imageId } = await params;
  return buildResponse(request, imageId, "HEAD");
}
