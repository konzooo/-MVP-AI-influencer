"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  loadAISettings,
  saveAISettings,
  type AISettings,
  type AIProvider,
  type CarouselStyle,
} from "@/lib/ai-settings";
import { Brain, Check, Camera, Layers } from "lucide-react";

interface AISettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AIProviderKey = "brainstormFromScratch" | "brainstormCopyPost" | "expandCarousel" | "captionHelper";

const TASK_INFO: Record<AIProviderKey, { label: string }> = {
  brainstormFromScratch: { label: "Brainstorm (From Scratch)" },
  brainstormCopyPost: { label: "Brainstorm (Copy Post)" },
  expandCarousel: { label: "Expand Carousel" },
  captionHelper: { label: "Caption Helper" },
};

const PROVIDER_INFO: Record<AIProvider, { name: string; cost: string; tag: string }> = {
  gemini: {
    name: "Gemini 2.5 Flash",
    cost: "Free",
    tag: "FAST",
  },
  claude: {
    name: "Claude Sonnet 4.5",
    cost: "$0.02",
    tag: "CREATIVE",
  },
};

const CAROUSEL_STYLE_INFO: Record<CarouselStyle, { label: string; description: string; icon: typeof Camera }> = {
  quick_snaps: {
    label: "Quick Snaps",
    description: "3 shots moments apart — same scene, different poses",
    icon: Camera,
  },
  curated_series: {
    label: "Curated Series",
    description: "Distinct, carefully composed shots from the same shoot",
    icon: Layers,
  },
};

export function AISettingsDialog({ open, onOpenChange }: AISettingsDialogProps) {
  const [settings, setSettings] = useState<AISettings | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setSettings(loadAISettings());
      setIsDirty(false);
    }
  }, [open]);

  const handleProviderChange = (task: AIProviderKey, provider: AIProvider) => {
    if (!settings) return;
    const updated = { ...settings, [task]: provider };
    setSettings(updated);
    setIsDirty(true);
  };

  const handleCarouselStyleChange = (style: CarouselStyle) => {
    if (!settings) return;
    setSettings({ ...settings, carouselStyle: style });
    setIsDirty(true);
  };

  const handleSave = () => {
    if (settings) {
      saveAISettings(settings);
      onOpenChange(false);
    }
  };

  if (!settings) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Brain className="h-4 w-4 text-violet-400" />
            Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {/* Section: AI Models */}
          <div>
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">AI Models</p>

            {/* Task rows */}
            <div className="space-y-1 border-t border-zinc-800">
              {(Object.keys(TASK_INFO) as AIProviderKey[]).map((task) => (
                <div
                  key={task}
                  className="flex items-center gap-3 rounded-none border-b border-zinc-800/50 px-3 py-2 hover:bg-zinc-900/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-zinc-200">{TASK_INFO[task].label}</p>
                    <p className="mt-0.5 text-[9px] text-zinc-500">{PROVIDER_INFO[settings[task] as AIProvider].cost}</p>
                  </div>

                  {/* Model selector: horizontal buttons */}
                  <div className="flex gap-1 flex-shrink-0">
                    {(["gemini", "claude"] as const).map((provider) => {
                      const isSelected = settings[task] === provider;
                      return (
                        <button
                          key={provider}
                          onClick={() => handleProviderChange(task, provider)}
                          className={`flex items-center gap-1 rounded px-2 py-1 text-[9px] font-medium transition-colors ${
                            isSelected
                              ? "bg-violet-600 text-white"
                              : "border border-zinc-700 bg-zinc-900/50 text-zinc-400 hover:border-zinc-600 hover:bg-zinc-900"
                          }`}
                          title={PROVIDER_INFO[provider].name}
                        >
                          {isSelected && <Check className="h-2.5 w-2.5" />}
                          <span>{provider === "gemini" ? "Gemini" : "Claude"}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Section: Carousel Style */}
          <div>
            <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Carousel Style</p>
            <div className="space-y-1 border-t border-zinc-800">
              {(["quick_snaps", "curated_series"] as CarouselStyle[]).map((style) => {
                const info = CAROUSEL_STYLE_INFO[style];
                const isSelected = settings.carouselStyle === style;
                const Icon = info.icon;
                return (
                  <button
                    key={style}
                    onClick={() => handleCarouselStyleChange(style)}
                    className={`flex w-full items-center gap-3 border-b border-zinc-800/50 px-3 py-2.5 text-left transition-colors ${
                      isSelected
                        ? "bg-violet-600/10"
                        : "hover:bg-zinc-900/50"
                    }`}
                  >
                    <div className={`flex h-7 w-7 items-center justify-center rounded ${
                      isSelected ? "bg-violet-600 text-white" : "bg-zinc-800 text-zinc-400"
                    }`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-medium ${isSelected ? "text-violet-300" : "text-zinc-200"}`}>
                        {info.label}
                      </p>
                      <p className="mt-0.5 text-[9px] text-zinc-500">{info.description}</p>
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-violet-400 flex-shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Model reference */}
        <div className="border-t border-zinc-800 pt-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Models</p>
          <div className="grid grid-cols-2 gap-2 text-[10px]">
            {(["gemini", "claude"] as const).map((provider) => (
              <div key={provider} className="rounded border border-zinc-800 bg-zinc-900/30 p-2">
                <p className="font-medium text-zinc-200">{PROVIDER_INFO[provider].name}</p>
                <p className="mt-0.5 text-zinc-500">
                  <span className="mr-1 inline-block rounded bg-zinc-800 px-1 py-0.5 text-[8px]">
                    {PROVIDER_INFO[provider].tag}
                  </span>
                  {PROVIDER_INFO[provider].cost}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-zinc-800 pt-3">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!isDirty}
            className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Save
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
