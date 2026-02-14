export type PostStatus = "draft" | "approved" | "generating" | "ready" | "posted";
export type PostType = "single_image" | "carousel" | "reel_cover" | "story";
export type CreationMode = "from_scratch" | "copy_post" | "from_own_images";

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
}

export interface GenerationAttempt {
  id: string;
  prompt: string;
  settings: GenerationSettings;
  images: GeneratedImage[];
  createdAt: string;
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
  filename: string;
  imagePath: string;
  thumbnailPath: string;
  summary: string;
  tags: string[];
  metadata: ReferenceImageMetadata;
  createdAt: string;
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
