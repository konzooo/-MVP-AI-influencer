import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";

const MODE = process.argv.includes("--apply") ? "apply" : "dry-run";
const ROOT = process.cwd();
const RESET_TIMESTAMP = new Date().toISOString();
const RESET_NOTE = `Automation reset on ${RESET_TIMESTAMP}. Task automation was removed from this post.`;

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return;
  }

  const contents = fs.readFileSync(filePath, "utf8");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    if (!key || process.env[key]) continue;

    let value = line.slice(separatorIndex + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    process.env[key] = value;
  }
}

function normalizeGeneratedImageUrl(url) {
  if (!url) return "";
  if (url.startsWith("/api/generated-images/")) {
    return url;
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/api/generated-images/")) {
      return `${parsed.pathname}${parsed.search}`;
    }
  } catch {
    // Leave non-URL values unchanged.
  }

  return url;
}

function appendNote(existing, note) {
  if (!existing || !existing.trim()) {
    return note;
  }

  if (existing.includes(note)) {
    return existing;
  }

  return `${existing}\n\n${note}`;
}

function stripLargeData(post) {
  const imagePrompts = Array.isArray(post.imagePrompts) ? post.imagePrompts : [];
  const generatedImages = Array.isArray(post.generatedImages) ? post.generatedImages : [];

  return {
    ...post,
    hashtags: Array.isArray(post.hashtags) ? post.hashtags : [],
    generationHistory: Array.isArray(post.generationHistory) ? post.generationHistory : [],
    referenceImages: [],
    imagePrompts: imagePrompts.map((ip) => ({
      ...ip,
      referenceImages: Array.isArray(ip.referenceImages)
        ? ip.referenceImages.filter((ref) => !ref.startsWith("data:"))
        : [],
    })),
    generatedImages: generatedImages
      .map((image) => ({
        ...image,
        url:
          typeof image.url !== "string"
            ? ""
            : !image.userProvided && image.url.startsWith("data:")
              ? ""
              : image.url,
      }))
      .filter((image) => image.url),
  };
}

function normalizePost(post) {
  let changed = false;
  const normalized = structuredClone(post);

  normalized.generatedImages = normalized.generatedImages.map((image) => {
    const nextUrl = normalizeGeneratedImageUrl(image.url);
    if (nextUrl !== image.url) {
      changed = true;
    }

    return {
      ...image,
      url: nextUrl,
    };
  });

  if (Object.prototype.hasOwnProperty.call(normalized, "autoAdvance")) {
    delete normalized.autoAdvance;
    changed = true;
  }

  return {
    post: normalized,
    changed,
  };
}

function resetTaskPost(post) {
  const { post: normalizedPost, changed: normalized } = normalizePost(post);
  const updated = structuredClone(normalizedPost);

  const originalStatus = updated.status;
  const hadTaskLink = Boolean(updated.taskId || updated.taskItemId);

  if (updated.status === "posted") {
    delete updated.taskId;
    delete updated.taskItemId;
    return { post: updated, changed: normalized || hadTaskLink, originalStatus };
  }

  if (updated.status === "ready") {
    delete updated.taskId;
    delete updated.taskItemId;
    return { post: updated, changed: normalized || hadTaskLink, originalStatus };
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
      error: appendNote(updated.publishingInfo?.error, RESET_NOTE),
    };
    delete updated.taskId;
    delete updated.taskItemId;
    return { post: updated, changed: true, originalStatus };
  }

  updated.status = "draft";
  updated.generationError = appendNote(updated.generationError, RESET_NOTE);
  delete updated.taskId;
  delete updated.taskItemId;
  return { post: updated, changed: true, originalStatus };
}

function formatCounts(map) {
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `  ${key}: ${value}`)
    .join("\n");
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env"));

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
  console.error("NEXT_PUBLIC_CONVEX_URL is not set. Load .env.local or export it first.");
  process.exit(1);
}

const client = new ConvexHttpClient(convexUrl);
const taskRows = await client.query(api.tasks.list);
const postRows = await client.query(api.posts.list);
const tasks = taskRows.map((row) => JSON.parse(row.data));
const posts = postRows.map((row) => JSON.parse(row.data));

const taskLinkedPosts = posts.filter((post) => post.taskId || post.taskItemId);
const statusCounts = {};
for (const post of taskLinkedPosts) {
  statusCounts[post.status] = (statusCounts[post.status] || 0) + 1;
}

const taskPostUpdates = taskLinkedPosts.map((post) => resetTaskPost(post));
const normalizedNonTaskPosts = posts
  .filter((post) => !post.taskId && !post.taskItemId)
  .map((post) => normalizePost(post))
  .filter((entry) => entry.changed);

const changedTaskPosts = taskPostUpdates.filter((entry) => entry.changed);
const normalizedImageCount = [
  ...taskPostUpdates,
  ...normalizedNonTaskPosts,
].reduce((sum, entry) => {
  const original = posts.find((post) => post.id === entry.post.id);
  if (!original) return sum;

  const originalUrls = (original.generatedImages || []).map((image) => image.url);
  const updatedUrls = (entry.post.generatedImages || []).map((image) => image.url);
  return (
    sum +
    updatedUrls.filter((url, index) => url !== originalUrls[index]).length
  );
}, 0);

console.log(`Automation reset mode: ${MODE}`);
console.log(`Tasks found: ${tasks.length}`);
console.log(`Task-linked posts found: ${taskLinkedPosts.length}`);
console.log(
  taskLinkedPosts.length > 0
    ? `Task-linked post statuses:\n${formatCounts(statusCounts)}`
    : "Task-linked post statuses: none"
);
console.log(`Task-linked posts to rewrite: ${changedTaskPosts.length}`);
console.log(`Other posts with generated-image URL normalization: ${normalizedNonTaskPosts.length}`);
console.log(`Generated image URLs to normalize: ${normalizedImageCount}`);

if (MODE !== "apply") {
  console.log("\nDry run complete. Re-run with --apply to perform the reset.");
  process.exit(0);
}

for (const entry of taskPostUpdates) {
  if (!entry.changed) continue;
  await client.mutation(api.posts.save, {
    postId: entry.post.id,
    data: JSON.stringify(stripLargeData(entry.post)),
  });
}

for (const entry of normalizedNonTaskPosts) {
  await client.mutation(api.posts.save, {
    postId: entry.post.id,
    data: JSON.stringify(stripLargeData(entry.post)),
  });
}

for (const task of tasks) {
  await client.mutation(api.tasks.remove, { taskId: task.id });
}

console.log("\nAutomation reset applied successfully.");
console.log(`Tasks deleted: ${tasks.length}`);
console.log(`Posts rewritten: ${changedTaskPosts.length + normalizedNonTaskPosts.length}`);
