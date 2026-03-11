export type PostStatus = "draft" | "approved" | "generating" | "ready" | "publishing" | "scheduled" | "posted";
export type PostType = "single_image" | "carousel" | "reel_cover" | "story";
export type CreationMode = "manual" | "from_scratch" | "copy_post" | "from_own_images";

export interface ImagePrompt {
  prompt: string;
  negativePrompt?: string;
  /** Reference images for this specific image (base64 data URIs) */
  referenceImages: string[];
  /** AI-generated structured description of the reference image (read-only, for transparency) */
  referenceImageAnalysis?: string;
}

/** Story-specific fields for programmatic posting */
export interface StoryConfig {
  textOverlay?: string;
  linkUrl?: string;
  duration?: number; // seconds (default 5 for images)
  backgroundColor?: string; // hex color for text-only stories
}

export interface GenerationSettings {
  imageSize: string;
  seed?: number;
  numImages: number;
  numVariations: number;
  enableSafetyChecker: boolean;
}

export type ReferenceImageSourceKey =
  | "original"
  | "improved"
  | "generated"
  | "uploaded";

export interface GeneratedImage {
  id: string;
  url: string;
  prompt: string;
  seed?: number;
  settings: GenerationSettings;
  selected: boolean;
  createdAt: string;
  /** Index of the imagePrompt this was generated from (for carousels) */
  promptIndex?: number;
  /** True if this image was uploaded by the user (not AI-generated) — should not be regenerated */
  userProvided?: boolean;
}

export interface GenerationAttempt {
  id: string;
  prompt: string;
  settings: GenerationSettings;
  images: GeneratedImage[];
  createdAt: string;
}

// Instagram publishing status tracking
export type PublishingStatus = "idle" | "creating_containers" | "publishing" | "published" | "scheduled" | "failed";

export interface PublishingInfo {
  status: PublishingStatus;
  igPostId?: string;
  permalink?: string;
  publishedAt?: string;
  scheduledFor?: string;
  error?: string;
}

export interface PostPlan {
  id: string;
  status: PostStatus;
  creationMode: CreationMode;
  createdAt: string;
  updatedAt: string;

  // Creative Lab output
  postType: PostType;
  title: string;
  description: string;
  caption: string;
  hashtags: string[];
  imagePrompts: ImagePrompt[];
  referenceImages: string[]; // Base64 data URIs of inspiration/source images
  notes: string;

  // Story-specific fields
  storyConfig?: StoryConfig;

  // Image Generation output
  generatedImages: GeneratedImage[];
  generationHistory: GenerationAttempt[];

  // Instagram publishing
  publishingInfo?: PublishingInfo;

  // Automated Tasks — links this post to a task
  taskId?: string;        // Which task created this post
  taskItemId?: string;    // Which inspiration item was used

  // Character reference — selected once at draft creation, used at generation
  selectedCharacterRefId?: string;    // Reference library image ID (legacy single)
  selectedCharacterRefPath?: string;  // e.g. "/api/reference-images/alba_028.jpg" or a reference-sized source path
  characterRefs?: { id: string; path: string }[];  // Multiple character references (up to 10)
}

// Reference Image Library Types
export interface ReferenceImageMetadata {
  schema_version: string;
  indoor_outdoor: "indoor" | "outdoor" | "unknown";
  place: {
    type: string;
    detail: string;
  };
  capture_method: "mirror_selfie" | "front_selfie" | "non_selfie";
  framing: "closeup" | "chest_up" | "waist_up" | "full_body";
  expression: {
    type: "smile" | "neutral" | "laugh" | "serious" | "other";
    mouth: "open" | "closed";
    detail: string;
  };
  time_of_day: "day" | "night" | "golden_hour" | "blue_hour" | "unknown";
  image_style: {
    color: "color" | "bw";
    detail: string;
  };
}

export interface ReferenceImage {
  id: string;
  sourceKey: ReferenceImageSourceKey;
  filename: string;
  /** Legacy/default preview path. Prefer originalPath/referencePath for explicit behavior. */
  imagePath: string;
  originalPath: string;
  referencePath: string;
  thumbnailPath: string;
  summary: string;
  tags: string[];
  metadata: ReferenceImageMetadata;
  createdAt: string;
  librarySource?: "reference" | "generated";
}

export interface ReferenceLibraryFilters {
  search: string;
  indoorOutdoor: "all" | "indoor" | "outdoor";
  captureMethod: "all" | "mirror_selfie" | "front_selfie" | "non_selfie";
  framing: "all" | "closeup" | "chest_up" | "waist_up" | "full_body";
  expression: "all" | "smile" | "neutral" | "laugh" | "serious";
  timeOfDay: "all" | "day" | "night" | "golden_hour" | "blue_hour";
}

export function createEmptyPost(
  creationMode: CreationMode = "from_scratch",
  postType: PostType = "single_image"
): PostPlan {
  const now = new Date().toISOString();
  const numPrompts = postType === "carousel" ? 3 : 1;
  return {
    id: crypto.randomUUID(),
    status: "draft",
    creationMode,
    createdAt: now,
    updatedAt: now,
    postType,
    title: "",
    description: "",
    caption: "",
    hashtags: [],
    imagePrompts: Array.from({ length: numPrompts }, () => ({
      prompt: "",
      referenceImages: [],
    })),
    referenceImages: [],
    notes: "",
    ...(postType === "story" ? { storyConfig: { duration: 5 } } : {}),
    generatedImages: [],
    generationHistory: [],
  };
}
