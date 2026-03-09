import { NextRequest, NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/instagram";
import { convexClientFromRequest } from "@/lib/convex-server";

export async function GET(request: NextRequest) {
  // Verify the user is authenticated
  const convexOrError = convexClientFromRequest(request);
  if (convexOrError instanceof NextResponse) return convexOrError;

  try {
    const appId = process.env.INSTAGRAM_APP_ID;
    if (!appId) {
      return NextResponse.json(
        { error: "INSTAGRAM_APP_ID not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/instagram/callback`;

    // Pass the Convex auth token via state so the callback can save to Convex
    const convexToken = request.headers.get("x-convex-auth")!;
    const authUrl = getOAuthUrl(appId, redirectUri, convexToken);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Instagram auth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
