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
 * - "angle_progression": A mini-shoot sequence that resolves to a full or lite
 *   prompt variant depending on how constrained the source material is.
 */
export type CarouselStyle = "quick_snaps" | "angle_progression";
export const CAROUSEL_STYLES = ["quick_snaps", "angle_progression"] as const;
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

export const DEFAULT_AI_SETTINGS: AISettings = {
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
  return value === "quick_snaps" || value === "angle_progression";
}

export function normalizeCarouselStyle(value: unknown): CarouselStyle | null {
  if (value === "curated_series") {
    return "angle_progression";
  }
  return isCarouselStyle(value) ? value : null;
}

export function sanitizeAISettings(raw: unknown): AISettings {
  if (!raw || typeof raw !== "object") return DEFAULT_AI_SETTINGS;

  const parsed = raw as Partial<Record<keyof AISettings, unknown>>;
  const next: AISettings = { ...DEFAULT_AI_SETTINGS };

  for (const key of AI_PROVIDER_KEYS) {
    if (isAIProvider(parsed[key])) {
      next[key] = parsed[key];
    }
  }

  const normalizedCarouselStyle = normalizeCarouselStyle(parsed.carouselStyle);
  if (normalizedCarouselStyle) {
    next.carouselStyle = normalizedCarouselStyle;
  }

  return next;
}

export function loadAISettings(): AISettings {
  if (typeof window === "undefined") return DEFAULT_AI_SETTINGS;
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_AI_SETTINGS;
    return sanitizeAISettings(JSON.parse(raw));
  } catch (error) {
    console.error("Failed to load AI settings:", error);
    return DEFAULT_AI_SETTINGS;
  }
}

/**
 * Load AI settings from Convex (async, works server-side).
 * Used by API routes and task runner when localStorage is unavailable.
 */
export async function loadAISettingsAsync(): Promise<AISettings> {
  try {
    const { getConvexClient } = await import("./convex-client");
    const { api } = await import("@/convex/_generated/api");
    const client = getConvexClient();
    const raw = await client.query(api.settings.get, { key: "aiSettings" });
    if (!raw) return DEFAULT_AI_SETTINGS;
    return sanitizeAISettings(JSON.parse(raw));
  } catch {
    return DEFAULT_AI_SETTINGS;
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
