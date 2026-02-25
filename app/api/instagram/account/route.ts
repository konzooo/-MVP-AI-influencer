import { NextResponse } from "next/server";
import { getAccountStatus } from "@/lib/instagram";

export async function GET() {
  try {
    const account = await getAccountStatus();
    return NextResponse.json(account);
  } catch (error) {
    console.error("Instagram account status error:", error);
    return NextResponse.json(
      { connected: false, error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
