/**
 * Server-side Convex HTTP client factory.
 * Used by Next.js API routes that need to call Convex with a user's auth token.
 *
 * The token is passed from the browser via the x-convex-auth header.
 */

import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";

const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

export function convexClientFromRequest(request: NextRequest): ConvexHttpClient | NextResponse {
  const token = request.headers.get("x-convex-auth");
  if (!token) {
    return NextResponse.json(
      { error: "Not authenticated — missing x-convex-auth header" },
      { status: 401 }
    );
  }
  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(token);
  return client;
}
