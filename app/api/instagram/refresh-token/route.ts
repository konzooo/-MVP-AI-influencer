import { NextRequest, NextResponse } from "next/server";
import { loadAuth, updateAuthToken, refreshLongLivedToken, isTokenExpired, getTokenDaysRemaining } from "@/lib/instagram";
import { convexClientFromRequest } from "@/lib/convex-server";

export async function POST(request: NextRequest) {
  const convexOrError = convexClientFromRequest(request);
  if (convexOrError instanceof NextResponse) return convexOrError;

  try {
    const auth = await loadAuth(convexOrError);
    if (!auth) {
      return NextResponse.json(
        { error: "No Instagram account connected" },
        { status: 400 }
      );
    }

    if (isTokenExpired(auth)) {
      return NextResponse.json(
        { error: "Token has expired. Please reconnect your account." },
        { status: 401 }
      );
    }

    const refreshed = await refreshLongLivedToken(auth.accessToken);
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + refreshed.expiresIn);

    await updateAuthToken(convexOrError, refreshed.accessToken, expiresAt.toISOString());

    return NextResponse.json({
      success: true,
      tokenExpiresAt: expiresAt.toISOString(),
      tokenDaysRemaining: getTokenDaysRemaining({ ...auth, tokenExpiresAt: expiresAt.toISOString() }),
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
