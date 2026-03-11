import { ConvexHttpClient } from "convex/browser";

let client: ConvexHttpClient | null = null;

/**
 * Shared ConvexHttpClient for non-React code (brainstorm.ts, task-runner.ts, etc.).
 * Uses HTTP requests (not WebSocket), suitable for one-off mutations/queries.
 */
export function getConvexClient(): ConvexHttpClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_CONVEX_URL;
    if (!url) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
    client = new ConvexHttpClient(url);
  }
  return client;
}
