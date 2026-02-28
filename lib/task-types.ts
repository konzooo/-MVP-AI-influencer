import { PostType } from "./types";

export type TaskApprovalMode = "manual" | "automatic";
export type TaskStatus = "running" | "paused" | "archived";
export type InspirationItemType = "own_image" | "copy_post" | "from_scratch";
export type InspirationItemStatus = "pending" | "used" | "skipped";

/**
 * Core Task definition
 * Tasks run on a cadence — started/paused/resumed by the user
 */
export interface Task {
  id: string;
  name: string;
  description: string;

  // running = active scheduler; paused = scheduler stopped; archived = hidden
  status: TaskStatus;

  // Approval & automation
  approvalMode: TaskApprovalMode;

  // How often to post
  cadence: {
    every: number;        // e.g. 1 (daily), 7 (weekly)
    unit: "days" | "weeks";
  };

  // Time of day to run (HH:MM, 24h, local time). Set when task is first started.
  scheduledTime: string | null;  // e.g. "09:30" — null until first Start

  // Generation defaults for all posts created by this task
  defaultPostType: PostType;
  defaultImageSize: string;     // e.g. "portrait_4_3"

  // Fallback configuration — used when inspiration queue is empty
  fallbackLocations: FallbackLocation[];
  fallbackNotes: string;

  // Inspiration queue — own_image + copy_post items consumed in order
  inspirationItems: InspirationItem[];

  // Timestamps
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;     // next scheduled run; null when paused
}

// ─── Fallback Location ───────────────────────────────────────────────────────

export interface FallbackLocation {
  location: string;
  weight: number;               // 1-10, higher = more likely
}

// ─── Inspiration Items ────────────────────────────────────────────────────────

export interface InspirationItemBase {
  id: string;
  type: InspirationItemType;
  status: InspirationItemStatus;
  notes: string;
  usedAt: string | null;
}

export interface OwnImageInspirationItem extends InspirationItemBase {
  type: "own_image";
  imageUrls: string[];
  postType: PostType;
}

export interface CopyPostInspirationItem extends InspirationItemBase {
  type: "copy_post";
  imageUrls: string[];
  thumbnailUrl?: string;
  postType: PostType;
}

export interface FromScratchInspirationItem extends InspirationItemBase {
  type: "from_scratch";
  preferredStyleMode: string | null;
  preferredLocation: string | null;
  postType: PostType;
}

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
  wasFallback: boolean;
  log: string[];
}
