import { NextRequest, NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/convex-client";

async function loadGeneratedImageRow(imageId: string) {
  const client = getConvexClient();

  try {
    return await client.query(api.generatedImages.get, { imageId });
  } catch {
    // Fall back to the list query in case the single-row lookup fails in Convex.
    const rows = await client.query(api.generatedImages.list, {});
    return rows.find((row) => row.imageId === imageId) ?? null;
  }
}

async function loadStoredImage(imageId: string): Promise<{
  upstreamUrl: string;
  upstreamContentType: string;
  buffer: Buffer;
}> {
  const client = getConvexClient();
  const row = await loadGeneratedImageRow(imageId);
  if (!row) {
    throw new Error("Image not found");
  }

  const upstreamUrl = await client.query(api.imageStorage.getUrl, {
    storageId: row.storageId,
  });

  if (!upstreamUrl) {
    throw new Error("Image URL not found");
  }

  const upstream = await fetch(upstreamUrl);
  if (!upstream.ok) {
    throw new Error(`Failed to fetch stored image: ${upstream.status}`);
  }

  return {
    upstreamUrl,
    upstreamContentType:
      upstream.headers.get("content-type") || "image/png",
    buffer: Buffer.from(await upstream.arrayBuffer()),
  };
}

async function buildResponse(
  request: NextRequest,
  imageId: string,
  method: "GET" | "HEAD"
) {
  try {
    const variant = request.nextUrl.searchParams.get("variant") || "original";
    const { upstreamContentType, buffer } = await loadStoredImage(imageId);

    if (variant === "publish") {
      const sharp = (await import("sharp")).default;
      const jpeg = await sharp(buffer).jpeg({ quality: 90, mozjpeg: true }).toBuffer();
      return new NextResponse(method === "HEAD" ? null : jpeg as unknown as BodyInit, {
        status: 200,
        headers: {
          "Content-Type": "image/jpeg",
          "Content-Length": String(jpeg.length),
          "Cache-Control": "public, max-age=31536000, immutable",
          "X-Robots-Tag": "noindex",
        },
      });
    }

    return new NextResponse(method === "HEAD" ? null : buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": upstreamContentType,
        "Content-Length": String(buffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to serve generated image";
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

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ imageId: string }>;
  }
) {
  try {
    const { imageId } = await params;
    const client = getConvexClient();
    await client.mutation(api.generatedImages.remove, { imageId });
    return NextResponse.json({ success: true });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to delete generated image";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
