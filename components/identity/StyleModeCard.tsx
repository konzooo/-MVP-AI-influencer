"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Trash2, ChevronDown, ChevronRight, X } from "lucide-react";
import type { StyleMode } from "@/lib/identity";

interface StyleModeCardProps {
  mode: StyleMode;
  onUpdate: (mode: StyleMode) => void;
  onDelete: () => void;
}

export function StyleModeCard({ mode, onUpdate, onDelete }: StyleModeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = <K extends keyof StyleMode>(field: K, value: StyleMode[K]) => {
    onUpdate({ ...mode, [field]: value });
  };

  const addClothingExample = () => {
    updateField("clothingExamples", [...mode.clothingExamples, ""]);
  };

  const updateClothingExample = (index: number, value: string) => {
    const updated = [...mode.clothingExamples];
    updated[index] = value;
    updateField("clothingExamples", updated);
  };

  const removeClothingExample = (index: number) => {
    const updated = mode.clothingExamples.filter((_, i) => i !== index);
    updateField("clothingExamples", updated);
  };

  const addLocation = () => {
    updateField("typicalLocations", [...mode.typicalLocations, ""]);
  };

  const updateLocation = (index: number, value: string) => {
    const updated = [...mode.typicalLocations];
    updated[index] = value;
    updateField("typicalLocations", updated);
  };

  const removeLocation = (index: number) => {
    const updated = mode.typicalLocations.filter((_, i) => i !== index);
    updateField("typicalLocations", updated);
  };

  const addAvoid = () => {
    updateField("avoidWith", [...mode.avoidWith, ""]);
  };

  const updateAvoid = (index: number, value: string) => {
    const updated = [...mode.avoidWith];
    updated[index] = value;
    updateField("avoidWith", updated);
  };

  const removeAvoid = (index: number) => {
    const updated = mode.avoidWith.filter((_, i) => i !== index);
    updateField("avoidWith", updated);
  };

  return (
    <Card className="border-zinc-800 bg-zinc-800/50">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-zinc-700/50 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 text-zinc-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-zinc-400" />
        )}
        <div className="flex-1">
          <h3 className="font-medium text-zinc-100">{mode.name}</h3>
          <p className="text-xs text-zinc-500">{mode.description}</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="text-zinc-500 hover:text-red-400 transition-colors"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </button>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="border-t border-zinc-700 p-4 space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400">Name</label>
            <Input
              value={mode.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <Textarea
              value={mode.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="What does this style look like?"
              className="mt-1 min-h-[60px] resize-none border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Clothing Examples</label>
              <button
                onClick={addClothingExample}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {mode.clothingExamples.map((example, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={example}
                    onChange={(e) => updateClothingExample(idx, e.target.value)}
                    placeholder="e.g. bikinis, linen shorts"
                    className="border-zinc-700 bg-zinc-900 text-zinc-100"
                  />
                  <button
                    onClick={() => removeClothingExample(idx)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Typical Locations</label>
              <button
                onClick={addLocation}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {mode.typicalLocations.map((location, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={location}
                    onChange={(e) => updateLocation(idx, e.target.value)}
                    placeholder="e.g. beach, poolside"
                    className="border-zinc-700 bg-zinc-900 text-zinc-100"
                  />
                  <button
                    onClick={() => removeLocation(idx)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Mood</label>
            <Input
              value={mode.mood}
              onChange={(e) => updateField("mood", e.target.value)}
              placeholder="e.g. relaxed, golden, effortless"
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Avoid With</label>
              <button
                onClick={addAvoid}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {mode.avoidWith.map((avoid, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={avoid}
                    onChange={(e) => updateAvoid(idx, e.target.value)}
                    placeholder="e.g. formal wear, city streets"
                    className="border-zinc-700 bg-zinc-900 text-zinc-100"
                  />
                  <button
                    onClick={() => removeAvoid(idx)}
                    className="text-zinc-500 hover:text-red-400"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
