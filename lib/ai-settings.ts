"use client";

export type AIProvider = "gemini" | "claude";

/**
 * Carousel style determines how companion slide prompts are generated:
 * - "quick_snaps": Short prompts focused on pose/expression changes only.
 *   Feels like 3 shots taken moments apart in the same scene.
 * - "curated_series": Detailed prompts describing full scene variations.
 *   Each slide is a distinct, carefully composed shot from the same shoot.
 */
export type CarouselStyle = "quick_snaps" | "curated_series";

export interface AISettings {
  brainstormFromScratch: AIProvider;
  brainstormCopyPost: AIProvider;
  expandCarousel: AIProvider;
  captionHelper: AIProvider;
  carouselStyle: CarouselStyle;
}

const DEFAULT_SETTINGS: AISettings = {
  brainstormFromScratch: "claude",
  brainstormCopyPost: "gemini",
  expandCarousel: "gemini",
  captionHelper: "gemini",
  carouselStyle: "quick_snaps",
};

const SETTINGS_KEY = "ai-influencer-ai-settings";

export function loadAISettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
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
