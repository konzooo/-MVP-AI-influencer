"use client";

export type AIProvider = "gemini" | "claude";
export const AI_PROVIDERS = ["gemini", "claude"] as const;
export const AI_PROVIDER_LABELS: Record<AIProvider, string> = {
  gemini: "Gemini 2.5 Flash",
  claude: "Claude 3.5 Sonnet",
};

/**
 * Carousel style determines how companion slide prompts are generated:
 * - "quick_snaps": Short prompts focused on pose/expression changes only.
 *   Feels like 3 shots taken moments apart in the same scene.
 * - "curated_series": Detailed prompts describing full scene variations.
 *   Each slide is a distinct, carefully composed shot from the same shoot.
 */
export type CarouselStyle = "quick_snaps" | "curated_series";
export const CAROUSEL_STYLES = ["quick_snaps", "curated_series"] as const;
export const AI_PROVIDER_KEYS = [
  "brainstormFromScratch",
  "brainstormCopyPost",
  "analyzeImages",
  "expandCarousel",
  "promptHelper",
  "captionHelper",
] as const;
export type AIProviderKey = (typeof AI_PROVIDER_KEYS)[number];

export interface AISettings {
  brainstormFromScratch: AIProvider;
  brainstormCopyPost: AIProvider;
  analyzeImages: AIProvider;
  expandCarousel: AIProvider;
  promptHelper: AIProvider;
  captionHelper: AIProvider;
  carouselStyle: CarouselStyle;
}

const DEFAULT_SETTINGS: AISettings = {
  brainstormFromScratch: "gemini",
  brainstormCopyPost: "gemini",
  analyzeImages: "gemini",
  expandCarousel: "gemini",
  promptHelper: "gemini",
  captionHelper: "gemini",
  carouselStyle: "quick_snaps",
};

const SETTINGS_KEY = "ai-influencer-ai-settings";

export function isAIProvider(value: unknown): value is AIProvider {
  return value === "gemini" || value === "claude";
}

export function isCarouselStyle(value: unknown): value is CarouselStyle {
  return value === "quick_snaps" || value === "curated_series";
}

function sanitizeAISettings(raw: unknown): AISettings {
  if (!raw || typeof raw !== "object") return DEFAULT_SETTINGS;

  const parsed = raw as Partial<Record<keyof AISettings, unknown>>;
  const next: AISettings = { ...DEFAULT_SETTINGS };

  for (const key of AI_PROVIDER_KEYS) {
    if (isAIProvider(parsed[key])) {
      next[key] = parsed[key];
    }
  }

  if (isCarouselStyle(parsed.carouselStyle)) {
    next.carouselStyle = parsed.carouselStyle;
  }

  return next;
}

export function loadAISettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return sanitizeAISettings(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to load AI settings:", error);
    return DEFAULT_SETTINGS;
  }
}

export function saveAISettings(settings: AISettings): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error("Failed to save AI settings:", error);
  }
}
