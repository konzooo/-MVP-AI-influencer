"use client";

import type { GeneratedImage, ReferenceImage, ReferenceImageMetadata } from "@/lib/types";

const GENERATED_IMAGE_LIBRARY_KEY = "ai-influencer-generated-image-library";
const GENERATED_IMAGE_LIBRARY_LIMIT = 250;

export const GENERATED_IMAGE_LIBRARY_UPDATED_EVENT = "generated-image-library-updated";

interface GeneratedImageLibraryEntry {
  id: string;
  filename: string;
  url: string;
  prompt: string;
  tags: string[];
  createdAt: string;
  postId?: string;
  postTitle?: string;
  promptIndex?: number;
}

const GENERATED_IMAGE_METADATA: ReferenceImageMetadata = {
  schema_version: "1.0",
  indoor_outdoor: "unknown",
  place: { type: "generated", detail: "fal.ai" },
  capture_method: "non_selfie",
  framing: "waist_up",
  expression: { type: "other", mouth: "closed", detail: "ai_generated" },
  time_of_day: "unknown",
  image_style: { color: "color", detail: "ai_generated" },
};

function dispatchGeneratedImageLibraryUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GENERATED_IMAGE_LIBRARY_UPDATED_EVENT));
}

function safeJsonParse<T>(raw: string | null): T[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function formatGeneratedFilename(createdAt: string, id: string): string {
  const date = new Date(createdAt);
  const stamp = Number.isNaN(date.getTime())
    ? createdAt.replace(/[^0-9]/g, "").slice(0, 14)
    : [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
        String(date.getHours()).padStart(2, "0"),
        String(date.getMinutes()).padStart(2, "0"),
        String(date.getSeconds()).padStart(2, "0"),
      ].join("");

  return `fal_${stamp}_${id.slice(0, 8)}.png`;
}

function buildTags(
  prompt: string,
  postTitle?: string
): string[] {
  const promptWords = prompt
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .slice(0, 6);

  const titleWords = (postTitle || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4)
    .slice(0, 4);

  return Array.from(new Set(["generated", "fal_ai", ...titleWords, ...promptWords]));
}

function entryToReferenceImage(entry: GeneratedImageLibraryEntry): ReferenceImage {
  return {
    id: entry.id,
    sourceKey: "generated",
    filename: entry.filename,
    imagePath: entry.url,
    originalPath: entry.url,
    referencePath: entry.url,
    thumbnailPath: entry.url,
    summary: entry.prompt || "Saved fal.ai output",
    tags: entry.tags,
    metadata: GENERATED_IMAGE_METADATA,
    createdAt: entry.createdAt,
    librarySource: "generated",
  };
}

export function loadGeneratedImageLibraryEntries(): GeneratedImageLibraryEntry[] {
  if (typeof window === "undefined") return [];
  const entries = safeJsonParse<GeneratedImageLibraryEntry>(
    window.localStorage.getItem(GENERATED_IMAGE_LIBRARY_KEY)
  );

  return entries
    .filter((entry) => entry && entry.id && entry.url)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function loadGeneratedImageLibrary(): ReferenceImage[] {
  return loadGeneratedImageLibraryEntries().map(entryToReferenceImage);
}

export function saveGeneratedImagesToLibrary(
  images: GeneratedImage[],
  options?: {
    postId?: string;
    postTitle?: string;
  }
): void {
  if (typeof window === "undefined") return;

  const existing = loadGeneratedImageLibraryEntries();
  const byUrl = new Map(existing.map((entry) => [entry.url, entry]));

  for (const image of images) {
    if (!image.url || image.userProvided) continue;

    const createdAt = image.createdAt || new Date().toISOString();
    const current = byUrl.get(image.url);
    const nextEntry: GeneratedImageLibraryEntry = {
      id: current?.id || `generated-${image.id || crypto.randomUUID()}`,
      filename: current?.filename || formatGeneratedFilename(createdAt, image.id || crypto.randomUUID()),
      url: image.url,
      prompt: image.prompt || current?.prompt || "Saved fal.ai output",
      tags: current?.tags?.length
        ? current.tags
        : buildTags(image.prompt || "", options?.postTitle),
      createdAt,
      postId: options?.postId || current?.postId,
      postTitle: options?.postTitle || current?.postTitle,
      promptIndex: image.promptIndex ?? current?.promptIndex,
    };

    byUrl.set(image.url, nextEntry);
  }

  const nextEntries = Array.from(byUrl.values())
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, GENERATED_IMAGE_LIBRARY_LIMIT);

  window.localStorage.setItem(
    GENERATED_IMAGE_LIBRARY_KEY,
    JSON.stringify(nextEntries)
  );
  dispatchGeneratedImageLibraryUpdated();
}

export function isGeneratedImageLibraryStorageEvent(event: StorageEvent): boolean {
  return event.key === GENERATED_IMAGE_LIBRARY_KEY;
}
