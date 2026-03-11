import { NextRequest, NextResponse } from "next/server";
import { brainstormWithGemini, BrainstormRequest } from "@/lib/gemini";
import { brainstormWithClaude } from "@/lib/claude";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as BrainstormRequest & { personaContext?: string; aiProvider?: string; carouselStyle?: string };
    const { idea, images, creationMode, postType, personaContext, aiProvider, carouselStyle } = body;

    if (!idea && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Please provide an idea or upload an image" },
        { status: 400 }
      );
    }

    // For from_scratch, try Claude first if specified, then fallback to Gemini
    if (creationMode === "from_scratch" && aiProvider === "claude") {
      try {
        const plan = await brainstormWithClaude({
          idea: idea || "",
          creationMode: creationMode || "from_scratch",
          postType: postType || "single_image",
          personaContext,
          carouselStyle: (carouselStyle as "quick_snaps" | "curated_series") || undefined,
        });
        return NextResponse.json(plan, {
          headers: {
            "x-ai-provider": "claude",
          },
        });
      } catch (claudeError) {
        console.warn("Claude brainstorm failed, falling back to Gemini:", claudeError);
        // Fall through to Gemini
      }
    }

    // Default or fallback to Gemini
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
      (carouselStyle as "quick_snaps" | "curated_series") || undefined
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
