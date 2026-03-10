import { NextRequest, NextResponse } from "next/server";
import { expandOwnImageForCarousel } from "@/lib/gemini";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const { image, notes, personaContext, carouselStyle, captionStyle } = await request.json();

    if (!image) {
      return NextResponse.json(
        { error: "Please provide an image" },
        { status: 400 }
      );
    }

    const result = await expandOwnImageForCarousel(image, notes || "", apiKey, personaContext, carouselStyle, captionStyle);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Expand carousel error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
