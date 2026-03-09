/**
 * POST /api/reference-images/migrate
 *
 * One-time migration endpoint: reads local reference images from filesystem
 * and uploads them to Convex storage. Only works in local dev environment.
 *
 * Called once, then deleted or ignored.
 */

import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import { join } from "path";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@/convex/_generated/api";

const IMAGES_PATH = "/Users/kons/Documents/Side/Images/<alba_ai0>/Training Data set";
const CONVEX_URL = process.env.NEXT_PUBLIC_CONVEX_URL!;

function parseMetadataFile(content: string) {
  const lines = content.split("\n");
  const summaryLine = lines.find((l) => l.startsWith("# summary:"));
  const tagsLine = lines.find((l) => l.startsWith("# tags:"));
  const jsonStart = lines.findIndex((l) => l === "---JSON---");
  const jsonEnd = lines.findIndex((l) => l === "---END---");

  const summary = summaryLine ? summaryLine.replace("# summary: ", "").trim() : "";
  const tagsStr = tagsLine ? tagsLine.replace("# tags: ", "").trim() : "";
  const tags = tagsStr ? tagsStr.split(", ").map((t) => t.trim()) : [];

  let metadata: any = null;
  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      metadata = JSON.parse(lines.slice(jsonStart + 1, jsonEnd).join("\n"));
    } catch {
      // use defaults
    }
  }

  if (!metadata) {
    metadata = {
      schema_version: "1.0",
      indoor_outdoor: "indoor",
      place: { type: "unknown", detail: "unknown" },
      capture_method: "non_selfie",
      framing: "waist_up",
      expression: { type: "neutral", mouth: "closed", detail: "unknown" },
      time_of_day: "day",
      image_style: { color: "color", detail: "unknown" },
    };
  }

  return { summary, tags, metadata };
}

export async function POST(request: NextRequest) {
  // Safety check: only allow in local dev
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Migration not allowed in production" }, { status: 403 });
  }

  // Get auth token from request header (passed from the browser)
  const authToken = request.headers.get("x-convex-auth");
  if (!authToken) {
    return NextResponse.json(
      { error: "Missing x-convex-auth header. Log in first, then call this endpoint with your session token." },
      { status: 401 }
    );
  }

  const client = new ConvexHttpClient(CONVEX_URL);
  client.setAuth(authToken);

  const results: { file: string; status: "ok" | "skip" | "error"; message?: string }[] = [];

  try {
    const files = await readdir(IMAGES_PATH);
    const imageFiles = files.filter((f) => f.match(/\.(png|jpg|jpeg)$/i)).sort();

    // Check what's already in Convex
    const existingRefs = await client.query(api.referenceImages.list);
    const existingFilenames = new Set(existingRefs.map((r: any) => r.filename));

    for (const imageFile of imageFiles) {
      if (existingFilenames.has(imageFile)) {
        results.push({ file: imageFile, status: "skip", message: "Already exists" });
        continue;
      }

      const baseName = imageFile.replace(/\.(png|jpg|jpeg)$/i, "");
      const txtFile = `${baseName}.txt`;

      if (!files.includes(txtFile)) {
        results.push({ file: imageFile, status: "skip", message: "No metadata file" });
        continue;
      }

      try {
        // Read image
        const imageBuffer = await readFile(join(IMAGES_PATH, imageFile));
        const mimeType = imageFile.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";

        // Read & parse metadata
        const txtContent = await readFile(join(IMAGES_PATH, txtFile), "utf-8");
        const { summary, tags, metadata } = parseMetadataFile(txtContent);

        // Get upload URL from Convex
        const uploadUrl = await client.mutation(api.referenceImages.generateUploadUrl);

        // Upload to Convex storage
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": mimeType },
          body: imageBuffer,
        });

        if (!uploadRes.ok) {
          throw new Error(`Upload failed: ${uploadRes.status}`);
        }

        const { storageId } = await uploadRes.json();

        // Create DB record
        await client.mutation(api.referenceImages.create, {
          filename: imageFile,
          storageId,
          summary,
          tags,
          metadata,
        });

        results.push({ file: imageFile, status: "ok" });
      } catch (err) {
        results.push({
          file: imageFile,
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  } catch (err) {
    return NextResponse.json(
      { error: `Failed to read images directory: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const skipped = results.filter((r) => r.status === "skip").length;
  const errors = results.filter((r) => r.status === "error").length;

  return NextResponse.json({ ok, skipped, errors, results });
}
