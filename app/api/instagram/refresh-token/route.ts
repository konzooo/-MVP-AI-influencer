import { NextResponse } from "next/server";
import {
  deleteAuth,
  getTokenDaysRemaining,
  isTokenExpired,
  loadAuth,
  refreshLongLivedToken,
  saveAuth,
} from "@/lib/instagram";

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
    const message = error instanceof Error ? error.message : "Unknown error";

    if (message.toLowerCase().includes("session has been invalidated")) {
      await deleteAuth();
      return NextResponse.json(
        { error: "Instagram session expired after a password or security change. Reconnect your account." },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
