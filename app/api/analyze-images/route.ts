import { NextRequest, NextResponse } from "next/server";
import { analyzeImagesWithGemini } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { images, notes, personaContext } = body;

    if (!images || !Array.isArray(images) || images.length === 0) {
      return NextResponse.json(
        { error: "At least one image is required" },
        { status: 400 }
      );
    }

    if (images.length > 5) {
      return NextResponse.json(
        { error: "Maximum 5 images allowed" },
        { status: 400 }
      );
    }

    const result = await analyzeImagesWithGemini(images, notes || "", apiKey, personaContext);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Image analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}
