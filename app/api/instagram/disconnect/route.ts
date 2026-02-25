import { NextResponse } from "next/server";
import { deleteAuth } from "@/lib/instagram";

export async function POST() {
  try {
    await deleteAuth();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Instagram disconnect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
