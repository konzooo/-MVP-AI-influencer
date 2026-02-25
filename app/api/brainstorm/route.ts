import { NextRequest, NextResponse } from "next/server";
import { brainstormWithGemini, BrainstormRequest } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const body = (await request.json()) as BrainstormRequest & { personaContext?: string };
    const { idea, images, creationMode, postType, personaContext } = body;

    if (!idea && (!images || images.length === 0)) {
      return NextResponse.json(
        { error: "Please provide an idea or upload an image" },
        { status: 400 }
      );
    }

    const plan = await brainstormWithGemini(
      {
        idea: idea || "",
        images: images || [],
        creationMode: creationMode || "from_scratch",
        postType: postType || "single_image",
      },
      apiKey,
      personaContext
    );
    return NextResponse.json(plan);
  } catch (error) {
    console.error("Brainstorm error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
