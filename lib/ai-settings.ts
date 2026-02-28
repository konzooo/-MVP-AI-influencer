"use client";

export type AIProvider = "gemini" | "claude";

export interface AISettings {
  brainstormFromScratch: AIProvider;
  brainstormCopyPost: AIProvider;
  expandCarousel: AIProvider;
  captionHelper: AIProvider;
}

const DEFAULT_SETTINGS: AISettings = {
  brainstormFromScratch: "claude",
  brainstormCopyPost: "gemini",
  expandCarousel: "gemini",
  captionHelper: "gemini",
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
