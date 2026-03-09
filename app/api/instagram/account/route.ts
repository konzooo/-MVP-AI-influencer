import { NextRequest, NextResponse } from "next/server";
import { getAccountStatus } from "@/lib/instagram";
import { convexClientFromRequest } from "@/lib/convex-server";

export async function GET(request: NextRequest) {
  const convexOrError = convexClientFromRequest(request);
  if (convexOrError instanceof NextResponse) return convexOrError;

  try {
    const account = await getAccountStatus(convexOrError);
    return NextResponse.json(account);
  } catch (error) {
    console.error("Instagram account status error:", error);
    return NextResponse.json(
      { connected: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
