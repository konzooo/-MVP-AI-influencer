import { NextRequest, NextResponse } from "next/server";
import { generateWithSeedream } from "@/lib/fal";
import { persistGeneratedImageFromFal } from "@/lib/generated-image-storage";

function normalizeImageUrl(request: NextRequest, url: string): string {
  if (!url) return url;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  if (url.startsWith("/")) {
    return new URL(url, request.url).toString();
  }

  return url;
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

    const body = await request.json();
    const {
      prompt,
      imageUrls,
      imageSize,
      numImages,
      maxImages,
      seed,
      enableSafetyChecker,
      postId,
      postTitle,
      promptIndex,
    } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    if (!imageUrls || imageUrls.length === 0) {
      return NextResponse.json(
        { error: "At least one reference image is required for Seedream 4.5" },
        { status: 400 }
      );
    }

    const result = await generateWithSeedream(
      {
        prompt,
        imageUrls: Array.isArray(imageUrls)
          ? imageUrls.map((url: string) => normalizeImageUrl(request, url))
          : [],
        imageSize,
        numImages,
        maxImages,
        seed: seed || undefined,
        enableSafetyChecker,
      },
      apiKey
    );

    const createdAt = new Date().toISOString();
    const persistedImages = await Promise.all(
      (result.images || []).map(async (img: { url: string; width?: number; height?: number; content_type?: string }, index: number) => {
        const imageId = crypto.randomUUID();
        const persisted = await persistGeneratedImageFromFal({
          imageId,
          falUrl: img.url,
          prompt,
          postId,
          postTitle,
          promptIndex:
            typeof promptIndex === "number" ? promptIndex : undefined,
          createdAt,
        });

        return {
          ...img,
          id: imageId,
          url: persisted.url,
          storageId: persisted.storageId,
          sourceUrl: persisted.sourceUrl,
          createdAt,
          order: index,
        };
      })
    );

    return NextResponse.json({
      ...result,
      images: persistedImages,
    });
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}
