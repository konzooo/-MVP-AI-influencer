import { NextRequest, NextResponse } from "next/server";
import { generateWithSeedream } from "@/lib/fal";

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
        imageUrls,
        imageSize,
        numImages,
        maxImages,
        seed: seed || undefined,
        enableSafetyChecker,
      },
      apiKey
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Generate error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}
