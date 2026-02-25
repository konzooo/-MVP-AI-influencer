"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Trash2, ChevronDown, ChevronRight, X } from "lucide-react";
import type { ContentTheme } from "@/lib/identity";

interface ContentThemeCardProps {
  theme: ContentTheme;
  onUpdate: (theme: ContentTheme) => void;
  onDelete: () => void;
}

export function ContentThemeCard({ theme, onUpdate, onDelete }: ContentThemeCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const updateField = <K extends keyof ContentTheme>(field: K, value: ContentTheme[K]) => {
    onUpdate({ ...theme, [field]: value });
  };

  const addScene = () => {
    updateField("exampleScenes", [...theme.exampleScenes, ""]);
  };

  const updateScene = (index: number, value: string) => {
    const updated = [...theme.exampleScenes];
    updated[index] = value;
    updateField("exampleScenes", updated);
  };

  const removeScene = (index: number) => {
    const updated = theme.exampleScenes.filter((_, i) => i !== index);
    updateField("exampleScenes", updated);
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
          <h3 className="font-medium text-zinc-100">{theme.name}</h3>
          <p className="text-xs text-zinc-500">{theme.description}</p>
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
              value={theme.name}
              onChange={(e) => updateField("name", e.target.value)}
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-zinc-400">Description</label>
            <Textarea
              value={theme.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="What is this content theme about?"
              className="mt-1 min-h-[60px] resize-none border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <label className="text-xs font-medium text-zinc-400">Example Scenes</label>
              <button
                onClick={addScene}
                className="text-xs text-violet-400 hover:text-violet-300"
              >
                + Add
              </button>
            </div>
            <div className="space-y-2">
              {theme.exampleScenes.map((scene, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    value={scene}
                    onChange={(e) => updateScene(idx, e.target.value)}
                    placeholder="e.g. bedroom mirror selfie"
                    className="border-zinc-700 bg-zinc-900 text-zinc-100"
                  />
                  <button
                    onClick={() => removeScene(idx)}
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
