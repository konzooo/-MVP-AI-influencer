import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // Key-value settings store (identity, aiSettings, costSettings)
  settings: defineTable({
    key: v.string(),
    value: v.string(), // JSON-stringified
  }).index("by_key", ["key"]),

  // Posts (full PostPlan data)
  posts: defineTable({
    postId: v.string(),
    data: v.string(), // JSON-stringified PostPlan
  })
    .index("by_postId", ["postId"]),

  // Generated images persisted to Convex storage
  generatedImages: defineTable({
    imageId: v.string(),
    storageId: v.id("_storage"),
    prompt: v.string(),
    postId: v.optional(v.string()),
    postTitle: v.optional(v.string()),
    promptIndex: v.optional(v.number()),
    createdAt: v.string(),
  }).index("by_imageId", ["imageId"]),

  // Reference images in Convex storage
  referenceImages: defineTable({
    imageId: v.string(),
    sourceKey: v.string(),
    filename: v.string(),
    storageId: v.id("_storage"),
    thumbnailStorageId: v.optional(v.id("_storage")),
    summary: v.string(),
    tags: v.array(v.string()),
    metadata: v.string(), // JSON-stringified ReferenceImageMetadata
    createdAt: v.string(),
  }).index("by_imageId", ["imageId"]),

  // Cost & LLM usage log
  costLog: defineTable({
    entryType: v.string(), // "generation" | "llm"
    timestamp: v.string(),
    cost: v.number(),
    provider: v.optional(v.string()),
    callType: v.optional(v.string()),
    inputTokens: v.optional(v.number()),
    outputTokens: v.optional(v.number()),
    model: v.optional(v.string()),
  }).index("by_timestamp", ["timestamp"]),

  // Automated tasks
  tasks: defineTable({
    taskId: v.string(),
    data: v.string(), // JSON-stringified Task
  }).index("by_taskId", ["taskId"]),

  // Instagram auth tokens
  instagramAuth: defineTable({
    accessToken: v.string(),
    tokenExpiresAt: v.string(),
    igUserId: v.string(),
    username: v.string(),
    profilePictureUrl: v.string(),
    connectedAt: v.string(),
  }),
});
