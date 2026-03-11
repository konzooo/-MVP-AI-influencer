import { NextResponse } from "next/server";
import { readFile, access } from "fs/promises";
import { join } from "path";

const AUTH_FILE = join(process.cwd(), ".instagram-auth.json");

/**
 * GET /api/instagram/migrate-auth
 *
 * One-time migration endpoint: reads the old .instagram-auth.json file
 * and returns its contents so the client can write it to Convex.
 * Returns { auth: null } if the file doesn't exist.
 */
export async function GET() {
  try {
    await access(AUTH_FILE);
    const raw = await readFile(AUTH_FILE, "utf-8");
    const auth = JSON.parse(raw);
    return NextResponse.json({ auth });
  } catch {
    return NextResponse.json({ auth: null });
  }
}
