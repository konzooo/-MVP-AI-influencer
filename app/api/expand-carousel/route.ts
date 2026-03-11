import { NextRequest, NextResponse } from "next/server";
import { expandOwnImageForCarousel } from "@/lib/gemini";
import { expandOwnImageForCarouselWithClaude } from "@/lib/claude";
import { isAIProvider } from "@/lib/ai-settings";

export async function POST(request: NextRequest) {
  try {
    const { image, notes, personaContext, carouselStyle, aiProvider } = await request.json();
    const provider = isAIProvider(aiProvider) ? aiProvider : "gemini";

    if (!image) {
      return NextResponse.json(
        { error: "Please provide an image" },
        { status: 400 }
      );
    }

    if (provider === "claude") {
      const result = await expandOwnImageForCarouselWithClaude(image, notes || "", personaContext, carouselStyle);
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

    const result = await expandOwnImageForCarousel(image, notes || "", apiKey, personaContext, carouselStyle);
    return NextResponse.json(result, {
      headers: {
        "x-ai-provider": "gemini",
      },
    });
  } catch (error) {
    console.error("Expand carousel error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
