import { NextRequest, NextResponse } from "next/server";
import { brainstormWithGemini, BrainstormRequest } from "@/lib/gemini";
import { brainstormWithClaude, buildClaudeResponseHeaders } from "@/lib/claude";
import { isAIProvider, normalizeCarouselStyle } from "@/lib/ai-settings";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BrainstormRequest & { personaContext?: string; aiProvider?: string; carouselStyle?: string };
    const { idea, images, creationMode, postType, personaContext, aiProvider, carouselStyle } = body;
    const provider = isAIProvider(aiProvider) ? aiProvider : "gemini";
    const normalizedCarouselStyle = normalizeCarouselStyle(carouselStyle) || undefined;

    if (!idea && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Please provide an idea or upload an image" },
        { status: 400 }
      );
    }

    if (provider === "claude") {
      const result = await brainstormWithClaude({
        idea: idea || "",
        images: images || [],
        creationMode: creationMode || "from_scratch",
        postType: postType || "single_image",
        personaContext,
        carouselStyle: normalizedCarouselStyle,
      });
      return NextResponse.json(result.data, { headers: buildClaudeResponseHeaders(result.usage) });
    }

    const geminApiKey = process.env.GEMINI_API_KEY;
    if (!geminApiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const plan = await brainstormWithGemini(
      {
        idea: idea || "",
        images: images || [],
        creationMode: creationMode || "from_scratch",
        postType: postType || "single_image",
      },
      geminApiKey,
      personaContext,
      normalizedCarouselStyle
    );
    return NextResponse.json(plan, {
      headers: {
        "x-ai-provider": "gemini",
      },
    });
  } catch (error) {
    console.error("Brainstorm error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
