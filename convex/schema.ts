import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// ─── Reusable validators ─────────────────────────────────────────────────────

const imagePromptValidator = v.object({
  prompt: v.string(),
  negativePrompt: v.optional(v.string()),
  referenceImages: v.array(v.string()),
  referenceImageAnalysis: v.optional(v.string()),
});

const generationSettingsValidator = v.object({
  imageSize: v.string(),
  seed: v.optional(v.number()),
  numImages: v.number(),
  numVariations: v.number(),
  enableSafetyChecker: v.boolean(),
});

const generatedImageValidator = v.object({
  id: v.string(),
  url: v.string(),
  prompt: v.string(),
  seed: v.optional(v.number()),
  settings: generationSettingsValidator,
  selected: v.boolean(),
  createdAt: v.string(),
  promptIndex: v.optional(v.number()),
  userProvided: v.optional(v.boolean()),
});

const generationAttemptValidator = v.object({
  id: v.string(),
  prompt: v.string(),
  settings: generationSettingsValidator,
  images: v.array(generatedImageValidator),
  createdAt: v.string(),
});

const storyConfigValidator = v.object({
  textOverlay: v.optional(v.string()),
  linkUrl: v.optional(v.string()),
  duration: v.optional(v.number()),
  backgroundColor: v.optional(v.string()),
});

const publishingInfoValidator = v.object({
  status: v.string(), // PublishingStatus
  igPostId: v.optional(v.string()),
  permalink: v.optional(v.string()),
  publishedAt: v.optional(v.string()),
  scheduledFor: v.optional(v.string()),
  error: v.optional(v.string()),
});

const characterRefValidator = v.object({
  id: v.string(),
  path: v.string(),
});

const fallbackLocationValidator = v.object({
  location: v.string(),
  weight: v.number(),
});

const cadenceValidator = v.object({
  every: v.number(),
  unit: v.string(), // "days" | "weeks"
});

// Inspiration items use a discriminated union — we use v.any() here because
// Convex validators don't natively support discriminated unions with varying
// shapes. TypeScript types in lib/task-types.ts still enforce safety client-side.
const inspirationItemValidator = v.any();

// ─── Reference image metadata ────────────────────────────────────────────────

const referenceImageMetadataValidator = v.object({
  schema_version: v.string(),
  indoor_outdoor: v.string(), // "indoor" | "outdoor" | "unknown"
  place: v.object({
    type: v.string(),
    detail: v.string(),
  }),
  capture_method: v.string(), // "mirror_selfie" | "front_selfie" | "non_selfie"
  framing: v.string(), // "closeup" | "chest_up" | "waist_up" | "full_body"
  expression: v.object({
    type: v.string(), // "smile" | "neutral" | "laugh" | "serious" | "other"
    mouth: v.string(), // "open" | "closed"
    detail: v.string(),
  }),
  time_of_day: v.string(), // "day" | "night" | "golden_hour" | "blue_hour" | "unknown"
  image_style: v.object({
    color: v.string(), // "color" | "bw"
    detail: v.string(),
  }),
});

// ─── Schema ──────────────────────────────────────────────────────────────────

export default defineSchema({
  ...authTables,

  posts: defineTable({
    userId: v.id("users"),
    // Keep original UUID for backwards-compat during migration
    externalId: v.string(),
    status: v.string(), // PostStatus
    creationMode: v.string(), // CreationMode
    postType: v.string(), // PostType
    title: v.string(),
    description: v.string(),
    caption: v.string(),
    hashtags: v.array(v.string()),
    notes: v.string(),
    imagePrompts: v.array(imagePromptValidator),
    referenceImages: v.array(v.string()),
    storyConfig: v.optional(storyConfigValidator),
    generatedImages: v.array(generatedImageValidator),
    generationHistory: v.array(generationAttemptValidator),
    publishingInfo: v.optional(publishingInfoValidator),
    taskId: v.optional(v.string()),
    taskItemId: v.optional(v.string()),
    selectedCharacterRefId: v.optional(v.string()),
    selectedCharacterRefPath: v.optional(v.string()),
    characterRefs: v.optional(v.array(characterRefValidator)),
    createdAt: v.string(),
    updatedAt: v.string(),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_userId_updatedAt", ["userId", "updatedAt"])
    .index("by_externalId", ["externalId"]),

  tasks: defineTable({
    userId: v.id("users"),
    externalId: v.string(),
    name: v.string(),
    description: v.string(),
    status: v.string(), // TaskStatus
    approvalMode: v.string(), // TaskApprovalMode
    cadence: cadenceValidator,
    scheduledTime: v.union(v.string(), v.null()),
    defaultPostType: v.string(), // PostType
    defaultImageSize: v.string(),
    fallbackLocations: v.array(fallbackLocationValidator),
    fallbackNotes: v.string(),
    inspirationItems: v.array(inspirationItemValidator),
    createdAt: v.string(),
    updatedAt: v.string(),
    lastRunAt: v.union(v.string(), v.null()),
    nextRunAt: v.union(v.string(), v.null()),
  })
    .index("by_userId", ["userId"])
    .index("by_userId_status", ["userId", "status"])
    .index("by_externalId", ["externalId"]),

  referenceImages: defineTable({
    userId: v.id("users"),
    filename: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    summary: v.string(),
    tags: v.array(v.string()),
    metadata: referenceImageMetadataValidator,
    createdAt: v.string(),
  })
    .index("by_userId", ["userId"]),

  instagramAuth: defineTable({
    userId: v.id("users"),
    accessToken: v.string(),
    tokenExpiresAt: v.string(),
    igUserId: v.string(),
    username: v.string(),
    profilePictureUrl: v.string(),
    connectedAt: v.string(),
  })
    .index("by_userId", ["userId"]),

  settings: defineTable({
    userId: v.id("users"),
    aiSettings: v.optional(v.any()), // AI model preferences
    identity: v.optional(v.any()), // InfluencerIdentity
    costTracker: v.optional(v.any()), // Cost tracking data
  })
    .index("by_userId", ["userId"]),
});
