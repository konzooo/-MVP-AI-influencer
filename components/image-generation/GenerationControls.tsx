"use client";

import { useState } from "react";
import { InfoTooltip } from "./InfoTooltip";
import { tooltips } from "@/lib/tooltips";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Settings2 } from "lucide-react";

// UI-specific settings interface (extends the persisted GenerationSettings)
export interface GenerationControlsSettings {
  imageSize: string;
  numVariations: number;
  seed: string;
  maxImages: number;
  enableSafetyChecker: boolean;
}

interface GenerationControlsProps {
  settings: GenerationControlsSettings;
  onChange: (settings: GenerationControlsSettings) => void;
}

const imageSizes = [
  { value: "square_hd", label: "Square HD (1:1)" },
  { value: "square", label: "Square (1:1)" },
  { value: "portrait_4_3", label: "Portrait (3:4)" },
  { value: "portrait_16_9", label: "Portrait (9:16)" },
  { value: "landscape_4_3", label: "Landscape (4:3)" },
  { value: "landscape_16_9", label: "Landscape (16:9)" },
  { value: "auto_2K", label: "Auto 2K" },
  { value: "auto_4K", label: "Auto 4K" },
];

export function GenerationControls({
  settings,
  onChange,
}: GenerationControlsProps) {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const update = (partial: Partial<GenerationControlsSettings>) => {
    onChange({ ...settings, ...partial });
  };

  return (
    <div className="space-y-4">
      {/* Default-visible settings */}
      <div className="flex flex-wrap items-end gap-4">
        {/* Image Size */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-zinc-400">Image Size</Label>
            <InfoTooltip text={tooltips.imageSize} />
          </div>
          <Select
            value={settings.imageSize}
            onValueChange={(v) => update({ imageSize: v })}
          >
            <SelectTrigger className="w-44 border-zinc-800 bg-zinc-900 text-xs text-zinc-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {imageSizes.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Num Variations */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <Label className="text-xs text-zinc-400">Variations</Label>
            <InfoTooltip text={tooltips.numVariations} />
          </div>
          <Select
            value={String(settings.numVariations)}
            onValueChange={(v) => update({ numVariations: parseInt(v) })}
          >
            <SelectTrigger className="w-20 border-zinc-800 bg-zinc-900 text-xs text-zinc-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Advanced section */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
          {isAdvancedOpen ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
          <Settings2 className="h-3 w-3" />
          Advanced Settings
        </CollapsibleTrigger>

        <CollapsibleContent className="mt-3 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          {/* Seed */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-zinc-400">Seed</Label>
              <InfoTooltip text={tooltips.seed} />
            </div>
            <Input
              type="text"
              value={settings.seed}
              onChange={(e) => update({ seed: e.target.value })}
              placeholder="Leave empty for random"
              className="w-44 border-zinc-800 bg-zinc-900 text-xs text-zinc-100"
            />
          </div>

          {/* Max Images */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-zinc-400">
                Max Images per Generation
              </Label>
              <InfoTooltip text={tooltips.maxImages} />
            </div>
            <Select
              value={String(settings.maxImages)}
              onValueChange={(v) => update({ maxImages: parseInt(v) })}
            >
              <SelectTrigger className="w-20 border-zinc-800 bg-zinc-900 text-xs text-zinc-100">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Safety Checker */}
          <div className="flex items-center gap-2">
            <Checkbox
              id="safety"
              checked={settings.enableSafetyChecker}
              onCheckedChange={(c) =>
                update({ enableSafetyChecker: c === true })
              }
            />
            <Label htmlFor="safety" className="text-xs text-zinc-400">
              Enable Safety Checker
            </Label>
            <InfoTooltip text={tooltips.safetyChecker} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
