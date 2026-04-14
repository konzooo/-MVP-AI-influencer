"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Task, TaskEditableFields, FallbackLocation } from "@/lib/task-types";
import { PostType } from "@/lib/types";
import { loadIdentity } from "@/lib/identity";
import { Plus, Minus, X } from "lucide-react";

interface TaskFormInlineProps {
  initialTask?: Task;
  onSave: (fields: TaskEditableFields) => void;
  onCancel: () => void;
}

const POST_TYPE_OPTIONS: { value: PostType; label: string }[] = [
  { value: "single_image", label: "Single Image" },
  { value: "carousel", label: "Carousel" },
  { value: "story", label: "Story" },
];

const IMAGE_SIZE_OPTIONS = [
  { value: "portrait_4_3", label: "Portrait 4:3 (768×1024, default)" },
  { value: "portrait_16_9", label: "Portrait 16:9 (576×1024)" },
  { value: "square_hd", label: "Square HD (1080×1080)" },
  { value: "square", label: "Square (512×512)" },
  { value: "landscape_4_3", label: "Landscape 4:3 (1024×768)" },
  { value: "landscape_16_9", label: "Landscape 16:9 (1024×576)" },
];

export function TaskFormInline({ initialTask, onSave, onCancel }: TaskFormInlineProps) {
  const identity = loadIdentity();
  const styleModeNames = identity.styleModes.map((mode) => mode.name);
  const filteredInitialAllowedStyleModes =
    initialTask?.allowedStyleModes?.filter((mode) => styleModeNames.includes(mode)) ?? [];
  const initialAllowedStyleModes =
    filteredInitialAllowedStyleModes.length > 0 ? filteredInitialAllowedStyleModes : styleModeNames;

  const [name, setName] = useState(initialTask?.name ?? "");
  const [description, setDescription] = useState(initialTask?.description ?? "");
  const [cadenceEvery, setCadenceEvery] = useState(initialTask?.cadence.every ?? 1);
  const [cadenceUnit, setCadenceUnit] = useState<"days" | "weeks">(initialTask?.cadence.unit ?? "days");
  const [defaultPostType, setDefaultPostType] = useState<PostType>(initialTask?.defaultPostType ?? "single_image");
  const [defaultImageSize, setDefaultImageSize] = useState(initialTask?.defaultImageSize ?? "portrait_4_3");
  const [styleModeScope, setStyleModeScope] = useState<"all" | "specific">(
    filteredInitialAllowedStyleModes.length > 0
      ? "specific"
      : "all"
  );
  const [allowedStyleModes, setAllowedStyleModes] = useState<string[]>(initialAllowedStyleModes);
  const [fallbackLocations, setFallbackLocations] = useState<FallbackLocation[]>(
    initialTask?.fallbackLocations ?? []
  );
  const [fallbackNotes, setFallbackNotes] = useState(initialTask?.fallbackNotes ?? "");

  const isEditing = !!initialTask;

  // Available locations that haven't been added yet
  const availableLocations = identity.preferredLocations.filter(
    (loc) => !fallbackLocations.some((fl) => fl.location === loc)
  );

  const addLocation = (location: string) => {
    setFallbackLocations((prev) => [...prev, { location, weight: 5 }]);
  };

  const removeLocation = (location: string) => {
    setFallbackLocations((prev) => prev.filter((fl) => fl.location !== location));
  };

  const updateWeight = (location: string, delta: number) => {
    setFallbackLocations((prev) =>
      prev.map((fl) =>
        fl.location === location
          ? { ...fl, weight: Math.max(1, Math.min(10, fl.weight + delta)) }
          : fl
      )
    );
  };

  const toggleStyleMode = (modeName: string) => {
    setAllowedStyleModes((prev) =>
      prev.includes(modeName)
        ? prev.filter((mode) => mode !== modeName)
        : [...prev, modeName]
    );
  };

  const handleSubmit = () => {
    if (!name.trim()) return;
    if (styleModeScope === "specific" && allowedStyleModes.length === 0) return;
    onSave({
      name: name.trim(),
      description: description.trim(),
      status: initialTask?.status ?? "paused",
      scheduledTime: initialTask?.scheduledTime ?? null,
      cadence: { every: cadenceEvery, unit: cadenceUnit },
      defaultPostType,
      defaultImageSize,
      fallbackLocations,
      fallbackNotes: fallbackNotes.trim(),
      allowedStyleModes:
        styleModeScope === "specific"
          ? styleModeNames.filter((modeName) => allowedStyleModes.includes(modeName))
          : [],
    });
  };

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="text-xs font-medium text-zinc-400">Task Name *</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Daily Beach Post"
          className="mt-1 border-zinc-700 bg-zinc-950 text-zinc-100"
          autoFocus
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-xs font-medium text-zinc-400">Description</label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this task for?"
          className="mt-1 min-h-[60px] resize-none border-zinc-700 bg-zinc-950 text-zinc-100"
        />
      </div>

      {/* Automation mode */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="text-xs font-medium text-zinc-400">Automation</label>
          <div className="mt-1 rounded border border-zinc-800 bg-zinc-900/50 px-3 py-2">
            <p className="text-xs font-medium text-zinc-200">Full Auto</p>
            <p className="mt-1 text-[10px] text-zinc-500">
              Each task run creates a post and the automation runner generates and publishes it without task-level approval.
            </p>
          </div>
        </div>
      </div>

      {/* Cadence */}
      <div>
        <label className="text-xs font-medium text-zinc-400">Cadence</label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-sm text-zinc-400">Every</span>
          <Input
            type="number"
            min={1}
            max={365}
            value={cadenceEvery}
            onChange={(e) => setCadenceEvery(Math.max(1, parseInt(e.target.value) || 1))}
            className="w-20 border-zinc-700 bg-zinc-950 text-zinc-100"
          />
          <div className="flex gap-2">
            {(["days", "weeks"] as const).map((u) => (
              <button
                key={u}
                onClick={() => setCadenceUnit(u)}
                className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
                  cadenceUnit === u
                    ? "bg-zinc-700 text-zinc-100"
                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Post type + Image size */}
      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="text-xs font-medium text-zinc-400">Default Post Type</label>
          <div className="mt-1 flex flex-col gap-1">
            {POST_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDefaultPostType(opt.value)}
                className={`rounded px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                  defaultPostType === opt.value
                    ? "bg-zinc-700 text-zinc-100"
                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-xs font-medium text-zinc-400">Image Size</label>
          <div className="mt-1 flex flex-col gap-1">
            {IMAGE_SIZE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDefaultImageSize(opt.value)}
                className={`rounded px-3 py-1.5 text-left text-xs font-medium transition-colors ${
                  defaultImageSize === opt.value
                    ? "bg-zinc-700 text-zinc-100"
                    : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Fallback style modes */}
      <div className="border-t border-zinc-800 pt-6">
        <label className="text-xs font-medium text-zinc-400">Fallback Style Modes</label>
        <p className="mt-0.5 text-[10px] text-zinc-600">
          Used only for from-scratch fallback posts when the queue is empty. The AI chooses from this set instead of a random style.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            onClick={() => setStyleModeScope("all")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              styleModeScope === "all"
                ? "bg-zinc-700 text-zinc-100"
                : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
            }`}
          >
            All Style Modes
          </button>
          <button
            onClick={() => setStyleModeScope("specific")}
            className={`rounded px-3 py-1.5 text-xs font-medium transition-colors ${
              styleModeScope === "specific"
                ? "bg-zinc-700 text-zinc-100"
                : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
            }`}
          >
            Choose Specific
          </button>
        </div>

        {styleModeScope === "specific" && (
          <>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {styleModeNames.map((modeName) => {
                const selected = allowedStyleModes.includes(modeName);
                return (
                  <button
                    key={modeName}
                    onClick={() => toggleStyleMode(modeName)}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${
                      selected
                        ? "bg-violet-900 text-violet-200"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300"
                    }`}
                  >
                    {modeName}
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-[10px] text-zinc-600">
              The LLM will see only these style modes, pick the best fit for the post idea, and stay within that lane.
            </p>
            {allowedStyleModes.length === 0 && (
              <p className="mt-2 text-[11px] text-amber-400">
                Pick at least one style mode.
              </p>
            )}
          </>
        )}
      </div>

      {/* Fallback: Location weights */}
      <div className="border-t border-zinc-800 pt-6">
        <label className="text-xs font-medium text-zinc-400">Fallback Locations & Weights</label>
        <p className="mt-0.5 text-[10px] text-zinc-600">
          When the inspiration queue is empty, AI picks a location based on these weights. Higher weight = more likely.
        </p>

        {/* Added locations */}
        {fallbackLocations.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {fallbackLocations.map((fl) => {
              const totalWeight = fallbackLocations.reduce((sum, l) => sum + l.weight, 0);
              const percentage = totalWeight > 0 ? Math.round((fl.weight / totalWeight) * 100) : 0;
              return (
                <div
                  key={fl.location}
                  className="flex items-center gap-2 rounded bg-zinc-800/50 px-3 py-2"
                >
                  <span className="flex-1 truncate text-sm text-zinc-200">{fl.location}</span>
                  <span className="text-[10px] text-zinc-500 w-8 text-right">{percentage}%</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => updateWeight(fl.location, -1)}
                      className="flex h-5 w-5 items-center justify-center rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200 transition-colors"
                    >
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="w-6 text-center text-xs font-medium text-zinc-300">{fl.weight}</span>
                    <button
                      onClick={() => updateWeight(fl.location, 1)}
                      className="flex h-5 w-5 items-center justify-center rounded bg-zinc-700 text-zinc-400 hover:bg-zinc-600 hover:text-zinc-200 transition-colors"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <button
                    onClick={() => removeLocation(fl.location)}
                    className="flex h-5 w-5 items-center justify-center rounded text-zinc-500 hover:bg-red-950 hover:text-red-400 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Add location buttons */}
        {availableLocations.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {availableLocations.map((loc) => (
              <button
                key={loc}
                onClick={() => addLocation(loc)}
                className="flex items-center gap-1 rounded bg-zinc-800 px-2.5 py-1 text-xs text-zinc-500 transition-colors hover:bg-zinc-700 hover:text-zinc-300"
              >
                <Plus className="h-3 w-3" />
                {loc}
              </button>
            ))}
          </div>
        )}

        {fallbackLocations.length === 0 && availableLocations.length === 0 && (
          <p className="mt-2 text-xs italic text-zinc-600">
            No locations configured in Identity Profile.
          </p>
        )}
      </div>

      {/* Fallback notes */}
      <div>
        <label className="text-xs font-medium text-zinc-400">Fallback Notes</label>
        <p className="mt-0.5 text-[10px] text-zinc-600">
          Extra context for AI when generating from-scratch posts (queue empty).
        </p>
        <Textarea
          value={fallbackNotes}
          onChange={(e) => setFallbackNotes(e.target.value)}
          placeholder="e.g. 'keep it casual and warm, golden hour vibes preferred'"
          className="mt-1 min-h-[60px] resize-none border-zinc-700 bg-zinc-950 text-zinc-100"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-zinc-800 pt-6">
        <Button
          onClick={handleSubmit}
          disabled={!name.trim() || (styleModeScope === "specific" && allowedStyleModes.length === 0)}
          className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          {isEditing ? "Save Changes" : "Create Task"}
        </Button>
        <Button
          variant="outline"
          onClick={onCancel}
          className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
