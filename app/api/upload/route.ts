import { NextRequest, NextResponse } from "next/server";
import { uploadToFalStorage } from "@/lib/fal";

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
    const { dataUri } = body as { dataUri: string };

    if (!dataUri) {
      return NextResponse.json(
        { error: "dataUri is required" },
        { status: 400 }
      );
    }

    const url = await uploadToFalStorage(dataUri, apiKey);
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Upload error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
