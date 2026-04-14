import { PostPlan } from "./types";

const GENERATED_IMAGE_PATH_PREFIX = "/api/generated-images/";

export function normalizeGeneratedImageUrl(url?: string | null): string {
  if (!url) return "";
  if (url.startsWith(GENERATED_IMAGE_PATH_PREFIX)) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith(GENERATED_IMAGE_PATH_PREFIX)) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Keep non-URL values unchanged.
  }

  return url;
}

function appendNote(existing: string | undefined, note: string): string {
  if (!existing?.trim()) {
    return note;
  }

  if (existing.includes(note)) {
    return existing;
  }

  return `${existing}\n\n${note}`;
}

function clearLegacyAutomationFields(post: PostPlan): void {
  delete (post as PostPlan & { autoAdvance?: boolean }).autoAdvance;
  delete post.taskId;
  delete post.taskItemId;
}

function normalizeGeneratedImages(post: PostPlan): void {
  post.generatedImages = post.generatedImages.map((image) => ({
    ...image,
    url: normalizeGeneratedImageUrl(image.url),
  }));
}

export function isTaskPostUnfinished(post: PostPlan): boolean {
  return post.status !== "posted";
}

export function detachTaskPostForReset(
  post: PostPlan,
  note: string
): PostPlan {
  const updated: PostPlan = structuredClone(post);
  normalizeGeneratedImages(updated);

  if (updated.status === "posted") {
    clearLegacyAutomationFields(updated);
    return updated;
  }

  if (updated.status === "ready") {
    clearLegacyAutomationFields(updated);
    return updated;
  }

  if (
    updated.status === "scheduled" ||
    updated.status === "publishing" ||
    updated.status === "approved"
  ) {
    updated.status = "ready";
    updated.publishingInfo = {
      ...updated.publishingInfo,
      status: "failed",
      error: appendNote(updated.publishingInfo?.error, note),
    };
    clearLegacyAutomationFields(updated);
    return updated;
  }

  updated.status = "draft";
  updated.generationError = appendNote(updated.generationError, note);
  clearLegacyAutomationFields(updated);
  return updated;
}

export function detachTaskPostForTaskDeletion(post: PostPlan): PostPlan {
  const note = "Task deleted. Automation was removed from this post.";
  const updated = structuredClone(post);
  normalizeGeneratedImages(updated);

  if (updated.status === "posted") {
    return updated;
  }

  if (
    updated.status === "scheduled" ||
    updated.status === "publishing" ||
    updated.status === "approved" ||
    updated.status === "ready"
  ) {
    updated.status = "ready";
    updated.publishingInfo = {
      ...updated.publishingInfo,
      status: "failed",
      error: appendNote(updated.publishingInfo?.error, note),
    };
    clearLegacyAutomationFields(updated);
    return updated;
  }

  updated.status = "draft";
  updated.generationError = appendNote(updated.generationError, note);
  clearLegacyAutomationFields(updated);
  return updated;
}

export function normalizePostGeneratedImageUrls(post: PostPlan): PostPlan {
  const updated = structuredClone(post);
  normalizeGeneratedImages(updated);
  return updated;
}
