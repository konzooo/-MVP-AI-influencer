"use client";

/**
 * Convex-backed settings hook.
 *
 * Replaces the localStorage-based loadIdentity/saveIdentity,
 * loadAISettings/saveAISettings, and getCostSettings/saveCostSettings.
 *
 * Falls back to defaults while loading or when unauthenticated.
 */

import { useQuery, useMutation } from "convex/react";
import { useCallback, useEffect } from "react";
import { api } from "@/convex/_generated/api";
import { DEFAULT_IDENTITY, type InfluencerIdentity } from "@/lib/identity";
import { type AISettings } from "@/lib/ai-settings";
import { type CostSettings } from "@/lib/cost-tracker";

const DEFAULT_AI_SETTINGS: AISettings = {
  brainstormFromScratch: "claude",
  brainstormCopyPost: "gemini",
  expandCarousel: "gemini",
  captionHelper: "gemini",
  carouselStyle: "quick_snaps",
};

const DEFAULT_COST_SETTINGS: CostSettings = {
  dailyWarningLimit: 1.0,
  dailyStopLimit: 5.0,
};

export function useSettings() {
  const settings = useQuery(api.settings.get);
  const saveIdentityMutation = useMutation(api.settings.saveIdentity);
  const saveAISettingsMutation = useMutation(api.settings.saveAISettings);
  const saveCostSettingsMutation = useMutation(api.settings.saveCostSettings);

  const loading = settings === undefined;

  // Sync Convex → localStorage so non-React lib code always has fresh values
  useEffect(() => {
    if (!settings || typeof window === "undefined") return;
    if (settings.identity) localStorage.setItem("ai-influencer-identity", JSON.stringify(settings.identity));
    if (settings.aiSettings) localStorage.setItem("ai-influencer-ai-settings", JSON.stringify(settings.aiSettings));
    if (settings.costTracker) localStorage.setItem("ai-influencer-cost-settings", JSON.stringify(settings.costTracker));
  }, [settings]);

  const identity: InfluencerIdentity = settings?.identity ?? DEFAULT_IDENTITY;
  const aiSettings: AISettings = settings?.aiSettings
    ? { ...DEFAULT_AI_SETTINGS, ...settings.aiSettings }
    : DEFAULT_AI_SETTINGS;
  const costSettings: CostSettings = settings?.costTracker
    ? { ...DEFAULT_COST_SETTINGS, ...settings.costTracker }
    : DEFAULT_COST_SETTINGS;

  const saveIdentity = useCallback(
    async (identity: InfluencerIdentity) => {
      await saveIdentityMutation({ identity });
      // Mirror to localStorage so non-React code (lib/task-runner, lib/brainstorm) picks it up
      if (typeof window !== "undefined") {
        localStorage.setItem("ai-influencer-identity", JSON.stringify(identity));
      }
    },
    [saveIdentityMutation]
  );

  const saveAISettings = useCallback(
    async (aiSettings: AISettings) => {
      await saveAISettingsMutation({ aiSettings });
      if (typeof window !== "undefined") {
        localStorage.setItem("ai-influencer-ai-settings", JSON.stringify(aiSettings));
      }
    },
    [saveAISettingsMutation]
  );

  const saveCostSettings = useCallback(
    async (costSettings: CostSettings) => {
      await saveCostSettingsMutation({ costSettings });
      if (typeof window !== "undefined") {
        localStorage.setItem("ai-influencer-cost-settings", JSON.stringify(costSettings));
      }
    },
    [saveCostSettingsMutation]
  );

  return {
    loading,
    identity,
    aiSettings,
    costSettings,
    saveIdentity,
    saveAISettings,
    saveCostSettings,
  };
}
