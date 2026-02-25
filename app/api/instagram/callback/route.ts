import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchAccountInfo,
  saveAuth,
  type InstagramAuth,
} from "@/lib/instagram";

export async function GET(request: NextRequest) {
  try {
    const appId = process.env.INSTAGRAM_APP_ID;
    const appSecret = process.env.INSTAGRAM_APP_SECRET;

    if (!appId || !appSecret) {
      return NextResponse.redirect(
        new URL("/post-manager?ig_error=missing_config", request.url)
      );
    }

    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      console.error("Instagram OAuth error:", error, searchParams.get("error_description"));
      return NextResponse.redirect(
        new URL(`/post-manager?ig_error=${encodeURIComponent(error)}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL("/post-manager?ig_error=no_code", request.url)
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/instagram/callback`;

    // Exchange code for long-lived token
    const { accessToken, userId } = await exchangeCodeForToken(
      code,
      appId,
      appSecret,
      redirectUri
    );

    // Fetch account info
    const { username, profilePictureUrl } = await fetchAccountInfo(userId, accessToken);

    // Calculate token expiry (long-lived tokens last 60 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Save auth
    const auth: InstagramAuth = {
      accessToken,
      tokenExpiresAt: expiresAt.toISOString(),
      igUserId: userId,
      username,
      profilePictureUrl,
      connectedAt: new Date().toISOString(),
    };

    await saveAuth(auth);

    return NextResponse.redirect(
      new URL("/post-manager?ig_connected=true", request.url)
    );
  } catch (error) {
    console.error("Instagram callback error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.redirect(
      new URL(`/post-manager?ig_error=${encodeURIComponent(message)}`, request.url)
    );
  }
}
