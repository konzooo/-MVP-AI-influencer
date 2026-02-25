import { PostType } from "./types";

export type TaskApprovalMode = "manual" | "automatic";
export type TaskStatus = "active" | "paused" | "archived";
export type InspirationItemType = "own_image" | "copy_post" | "from_scratch";
export type InspirationItemStatus = "pending" | "used" | "skipped";

/**
 * Core Task definition
 * Tasks run on a cadence and auto-create posts using inspiration items
 */
export interface Task {
  id: string;
  name: string;
  description: string;
  status: TaskStatus;

  // Approval & automation
  approvalMode: TaskApprovalMode;

  // Cadence (for display; "Run Now" button is primary trigger in POC)
  cadence: {
    every: number;        // e.g. 1 (daily), 7 (weekly)
    unit: "days" | "weeks";
  };

  // Generation defaults for all posts created by this task
  defaultPostType: PostType;
  defaultImageSize: string;     // e.g. "portrait_4_3"

  // Inspiration queue — used in order, falls back to from_scratch when empty
  inspirationItems: InspirationItem[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;     // computed: lastRunAt + cadence
}

// ─── Inspiration Items ────────────────────────────────────────────────────────

export interface InspirationItemBase {
  id: string;
  type: InspirationItemType;
  status: InspirationItemStatus;
  notes: string;               // free-text fed to Gemini as context
  usedAt: string | null;
}

/**
 * User's own image(s) — becomes the post or carousel slide 1
 * Images pre-uploaded to fal.ai CDN at creation time (safe for localStorage)
 */
export interface OwnImageInspirationItem extends InspirationItemBase {
  type: "own_image";
  imageUrls: string[];         // CDN URLs — 1 for single/story, 1 for carousel
  postType: PostType;
}

/**
 * Reference post(s) to recreate — uses brainstorm's "copy_post" mode
 * Images pre-uploaded to fal.ai CDN at creation time
 */
export interface CopyPostInspirationItem extends InspirationItemBase {
  type: "copy_post";
  imageUrls: string[];         // CDN URLs for generation
  thumbnailUrl?: string;       // optional first image as thumbnail for list
  postType: PostType;
}

/**
 * Fully AI-generated — uses brainstorm's "from_scratch" mode
 * Optional style mode and location overrides; null = let AI pick
 */
export interface FromScratchInspirationItem extends InspirationItemBase {
  type: "from_scratch";
  preferredStyleMode: string | null;   // e.g. "Beach / Coastal"
  preferredLocation: string | null;    // e.g. "Travel: Southeast Asia"
  postType: PostType;
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type InspirationItem =
  | OwnImageInspirationItem
  | CopyPostInspirationItem
  | FromScratchInspirationItem;

// ─── Task Run Result ──────────────────────────────────────────────────────────

export interface TaskRunResult {
  success: boolean;
  postId: string | null;
  error: string | null;
  usedItem: InspirationItem | null;
  wasFallback: boolean;        // true if queue was empty and from_scratch synthesized
  log: string[];               // step-by-step execution log
}
