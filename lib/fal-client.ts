"use client";

import { fal } from "@fal-ai/client";

/**
 * Client-side only: Upload to FAL storage
 * This must run in the browser because fal.storage.upload() is a browser API
 * The FAL client auto-configures with default credentials on the browser
 */
export async function uploadToFalStorageClient(dataUri: string): Promise<string> {
  const match = dataUri.match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    console.error("[fal.ai] Invalid data URI format");
    throw new Error("Invalid data URI");
  }

  const mimeType = match[1];
  const base64 = match[2];

  try {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mimeType });

    // FAL client auto-configures on browser side with default public storage
    const url = await fal.storage.upload(blob);
    console.log("[fal.ai] Upload successful:", url);
    return url;
  } catch (error) {
    console.error("[fal.ai] Upload failed, falling back to data URI:", error);
    // Fallback to data URI if FAL upload fails
    return dataUri;
  }
}
