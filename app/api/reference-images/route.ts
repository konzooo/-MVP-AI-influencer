import { NextResponse } from "next/server";
import { loadReferenceImages } from "@/lib/reference-image-library";

export async function GET() {
  try {
    const images = await loadReferenceImages();
    return NextResponse.json({
      images,
      total: images.length,
    });
  } catch (error) {
    console.error("Failed to load reference images:", error);
    return NextResponse.json(
      { error: "Failed to load reference images" },
      { status: 500 }
    );
  }
}
