import { NextResponse } from "next/server";
import { loadAuth, saveAuth, refreshLongLivedToken, isTokenExpired, getTokenDaysRemaining } from "@/lib/instagram";

export async function POST() {
  try {
    const auth = await loadAuth();
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

    const updatedAuth = {
      ...auth,
      accessToken: refreshed.accessToken,
      tokenExpiresAt: expiresAt.toISOString(),
    };

    await saveAuth(updatedAuth);

    return NextResponse.json({
      success: true,
      tokenExpiresAt: updatedAuth.tokenExpiresAt,
      tokenDaysRemaining: getTokenDaysRemaining(updatedAuth),
    });
  } catch (error) {
    console.error("Token refresh error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
