import { NextRequest, NextResponse } from "next/server";
import { deleteAuth } from "@/lib/instagram";
import { convexClientFromRequest } from "@/lib/convex-server";

export async function POST(request: NextRequest) {
  const convexOrError = convexClientFromRequest(request);
  if (convexOrError instanceof NextResponse) return convexOrError;

  try {
    await deleteAuth(convexOrError);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Instagram disconnect error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
