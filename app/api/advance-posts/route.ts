import { NextResponse } from "next/server";
import { advanceOnePost } from "@/lib/post-advancer";

export const maxDuration = 60; // Vercel Hobby max — one post per tick keeps this comfortably within limit

/**
 * POST /api/advance-posts
 *
 * Cron endpoint — advances ONE automatic-mode post one step through the pipeline.
 * Called by Convex cron every minute.
 *
 * Pipeline (one step per tick):
 *   draft/approved  → generate images → ready (or generating if partial)
 *   generating      → resume generation → ready
 *   ready           → publish to Instagram → posted
 *
 * Optional header: Authorization: Bearer <CRON_SECRET>
 */
export async function POST(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  const result = await advanceOnePost();

  return NextResponse.json({
    advanced: result.advanced,
    postId: result.postId,
    action: result.action,
    error: result.error,
    log: result.log,
  });
}
