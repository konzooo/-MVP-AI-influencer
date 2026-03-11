"use client";

import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCallback, useEffect, useMemo } from "react";
import { DEFAULT_IDENTITY, type InfluencerIdentity } from "@/lib/identity";
import { type AISettings } from "@/lib/ai-settings";
import { type CostSettings } from "@/lib/cost-tracker";

const DEFAULT_AI_SETTINGS: AISettings = {
  brainstormFromScratch: "gemini",
  brainstormCopyPost: "gemini",
  analyzeImages: "gemini",
  expandCarousel: "gemini",
  promptHelper: "gemini",
  captionHelper: "gemini",
  carouselStyle: "quick_snaps",
};

const DEFAULT_COST_SETTINGS: CostSettings = {
  dailyWarningLimit: 1.0,
  dailyStopLimit: 5.0,
  geminiDailyLimit: 20,
};

// localStorage keys (kept in sync for lib/ code that still reads from localStorage)
const LS_KEYS = {
  identity: "ai-influencer-identity",
  aiSettings: "ai-influencer-ai-settings",
  costSettings: "ai-influencer-cost-settings",
} as const;

/** Mirror a value to localStorage so lib/ code (brainstorm.ts, task-runner.ts) can read it */
function mirrorToLocalStorage(key: string, value: string) {
  try {
    if (typeof window !== "undefined") {
      localStorage.setItem(key, value);
    }
  } catch {
    // Silently ignore quota errors
  }
}

// ─── Identity ────────────────────────────────────────────────────────────────

export function useIdentity() {
  const raw = useQuery(api.settings.get, { key: "identity" });
  const set = useMutation(api.settings.set);

  const identity: InfluencerIdentity = useMemo(
    () => (raw != null ? { ...DEFAULT_IDENTITY, ...JSON.parse(raw) } : DEFAULT_IDENTITY),
    [raw]
  );

  const isLoading = raw === undefined;

  // Mirror Convex data to localStorage whenever it changes
  useEffect(() => {
    if (raw != null) {
      mirrorToLocalStorage(LS_KEYS.identity, raw);
    }
  }, [raw]);

  const saveIdentity = useCallback(
    async (updated: InfluencerIdentity) => {
      const value = JSON.stringify(updated);
      mirrorToLocalStorage(LS_KEYS.identity, value);
      await set({ key: "identity", value });
    },
    [set]
  );

  return { identity, isLoading, saveIdentity };
}

// ─── AI Settings ─────────────────────────────────────────────────────────────

export function useAISettings() {
  const raw = useQuery(api.settings.get, { key: "aiSettings" });
  const set = useMutation(api.settings.set);

  const settings: AISettings = useMemo(
    () => (raw != null ? { ...DEFAULT_AI_SETTINGS, ...JSON.parse(raw) } : DEFAULT_AI_SETTINGS),
    [raw]
  );

  const isLoading = raw === undefined;

  useEffect(() => {
    if (raw != null) {
      mirrorToLocalStorage(LS_KEYS.aiSettings, raw);
    }
  }, [raw]);

  const saveAISettings = useCallback(
    async (updated: AISettings) => {
      const value = JSON.stringify(updated);
      mirrorToLocalStorage(LS_KEYS.aiSettings, value);
      await set({ key: "aiSettings", value });
    },
    [set]
  );

  return { settings, isLoading, saveAISettings };
}

// ─── Cost Settings ───────────────────────────────────────────────────────────

export function useCostSettings() {
  const raw = useQuery(api.settings.get, { key: "costSettings" });
  const set = useMutation(api.settings.set);

  const settings: CostSettings = useMemo(
    () => (raw != null ? { ...DEFAULT_COST_SETTINGS, ...JSON.parse(raw) } : DEFAULT_COST_SETTINGS),
    [raw]
  );

  const isLoading = raw === undefined;

  useEffect(() => {
    if (raw != null) {
      mirrorToLocalStorage(LS_KEYS.costSettings, raw);
    }
  }, [raw]);

  const saveCostSettings = useCallback(
    async (updated: CostSettings) => {
      const value = JSON.stringify(updated);
      mirrorToLocalStorage(LS_KEYS.costSettings, value);
      await set({ key: "costSettings", value });
    },
    [set]
  );

  return { settings, isLoading, saveCostSettings };
}
