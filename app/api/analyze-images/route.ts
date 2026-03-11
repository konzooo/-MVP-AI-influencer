import { NextRequest, NextResponse } from "next/server";
import { analyzeImagesWithGemini } from "@/lib/gemini";
import { analyzeImagesWithClaude } from "@/lib/claude";
import { isAIProvider } from "@/lib/ai-settings";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { images, notes, personaContext, aiProvider } = body;
    const provider = isAIProvider(aiProvider) ? aiProvider : "gemini";

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

    if (provider === "claude") {
      const result = await analyzeImagesWithClaude(images, notes || "", personaContext);
      return NextResponse.json(result, {
        headers: {
          "x-ai-provider": "claude",
        },
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const result = await analyzeImagesWithGemini(images, notes || "", apiKey, personaContext);

    return NextResponse.json(result, {
      headers: {
        "x-ai-provider": "gemini",
      },
    });
  } catch (error) {
    console.error("Image analysis error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 }
    );
  }
}
