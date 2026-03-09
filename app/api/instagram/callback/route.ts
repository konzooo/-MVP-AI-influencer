import { NextRequest, NextResponse } from "next/server";
import {
  exchangeCodeForToken,
  fetchAccountInfo,
  saveAuth,
  type InstagramAuth,
} from "@/lib/instagram";
import { ConvexHttpClient } from "convex/browser";

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
    // Convex auth token passed through OAuth state parameter
    const convexToken = searchParams.get("state");

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

    if (!convexToken) {
      return NextResponse.redirect(
        new URL("/post-manager?ig_error=missing_auth", request.url)
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const redirectUri = `${baseUrl}/api/instagram/callback`;

    const { accessToken, userId } = await exchangeCodeForToken(code, appId, appSecret, redirectUri);
    const { username, profilePictureUrl } = await fetchAccountInfo(userId, accessToken);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    const auth: InstagramAuth = {
      accessToken,
      tokenExpiresAt: expiresAt.toISOString(),
      igUserId: userId,
      username,
      profilePictureUrl,
      connectedAt: new Date().toISOString(),
    };

    const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
    convex.setAuth(convexToken);
    await saveAuth(convex, auth);

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
