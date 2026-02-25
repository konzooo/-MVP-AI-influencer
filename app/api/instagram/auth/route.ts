import { NextResponse } from "next/server";
import { getOAuthUrl } from "@/lib/instagram";

export async function GET() {
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

    const authUrl = getOAuthUrl(appId, redirectUri);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error("Instagram auth error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
