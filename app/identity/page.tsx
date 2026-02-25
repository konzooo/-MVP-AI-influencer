"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Trash2, Plus } from "lucide-react";
import { loadIdentity, saveIdentity, DEFAULT_IDENTITY, type InfluencerIdentity, type StyleMode, type ContentTheme } from "@/lib/identity";
import { StyleModeCard } from "@/components/identity/StyleModeCard";
import { ContentThemeCard } from "@/components/identity/ContentThemeCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function IdentityPage() {
  const [identity, setIdentity] = useState<InfluencerIdentity | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    const loaded = loadIdentity();
    setIdentity(loaded);
    setIsLoading(false);
  }, []);

  if (isLoading || !identity) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  const handleSave = () => {
    saveIdentity(identity);
    setHasChanges(false);
    toast.success("Identity profile saved");
  };

  const handleReset = () => {
    setIdentity(DEFAULT_IDENTITY);
    saveIdentity(DEFAULT_IDENTITY);
    setHasChanges(false);
    setShowResetConfirm(false);
    toast.success("Identity reset to defaults");
  };

  const updateField = <K extends keyof InfluencerIdentity>(field: K, value: InfluencerIdentity[K]) => {
    setIdentity({ ...identity, [field]: value });
    setHasChanges(true);
  };

  const addStyleMode = () => {
    const newMode: StyleMode = {
      name: "New Style",
      description: "",
      clothingExamples: [],
      typicalLocations: [],
      mood: "",
      avoidWith: [],
    };
    updateField("styleModes", [...identity.styleModes, newMode]);
  };

  const updateStyleMode = (index: number, mode: StyleMode) => {
    const updated = [...identity.styleModes];
    updated[index] = mode;
    updateField("styleModes", updated);
  };

  const removeStyleMode = (index: number) => {
    const updated = identity.styleModes.filter((_, i) => i !== index);
    updateField("styleModes", updated);
  };

  const addContentTheme = () => {
    const newTheme: ContentTheme = {
      name: "New Theme",
      description: "",
      exampleScenes: [],
    };
    updateField("contentThemes", [...identity.contentThemes, newTheme]);
  };

  const updateContentTheme = (index: number, theme: ContentTheme) => {
    const updated = [...identity.contentThemes];
    updated[index] = theme;
    updateField("contentThemes", updated);
  };

  const removeContentTheme = (index: number) => {
    const updated = identity.contentThemes.filter((_, i) => i !== index);
    updateField("contentThemes", updated);
  };

  const addVarietyGuide = () => {
    updateField("varietyGuidelines", [...identity.varietyGuidelines, ""]);
  };

  const updateVarietyGuide = (index: number, value: string) => {
    const updated = [...identity.varietyGuidelines];
    updated[index] = value;
    updateField("varietyGuidelines", updated);
  };

  const removeVarietyGuide = (index: number) => {
    const updated = identity.varietyGuidelines.filter((_, i) => i !== index);
    updateField("varietyGuidelines", updated);
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-zinc-100">Identity Profile</h1>
          <p className="mt-1 text-sm text-zinc-400">
            Define {identity.name}'s persona to shape AI-generated content
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-medium ${identity.isActive ? "text-emerald-400" : "text-zinc-500"}`}>
              {identity.isActive ? "Active" : "Inactive"}
            </span>
            <Switch
              checked={identity.isActive}
              onCheckedChange={(checked) => updateField("isActive", checked)}
            />
          </div>
        </div>
      </div>

      {/* Core Identity */}
      <Card className="mb-6 border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Core Identity</h2>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-zinc-400">Name</label>
              <Input
                value={identity.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-zinc-400">Age</label>
              <Input
                type="number"
                value={identity.age}
                onChange={(e) => updateField("age", parseInt(e.target.value) || 0)}
                className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Nationality</label>
            <Input
              value={identity.nationality}
              onChange={(e) => updateField("nationality", e.target.value)}
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Occupation</label>
            <Input
              value={identity.occupation}
              onChange={(e) => updateField("occupation", e.target.value)}
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Backstory</label>
            <Textarea
              value={identity.backstory}
              onChange={(e) => updateField("backstory", e.target.value)}
              placeholder="Write a short paragraph about the character's background..."
              className="mt-1 min-h-[100px] resize-none border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>
        </div>
      </Card>

      {/* Style Modes */}
      <Card className="mb-6 border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Style Modes ({identity.styleModes.length})</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={addStyleMode}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Mode
          </Button>
        </div>
        <div className="space-y-4">
          {identity.styleModes.map((mode, idx) => (
            <StyleModeCard
              key={idx}
              mode={mode}
              onUpdate={(updated) => updateStyleMode(idx, updated)}
              onDelete={() => removeStyleMode(idx)}
            />
          ))}
        </div>
      </Card>

      {/* Content Themes */}
      <Card className="mb-6 border-zinc-800 bg-zinc-900/50 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-zinc-100">Content Themes ({identity.contentThemes.length})</h2>
          <Button
            size="sm"
            variant="outline"
            onClick={addContentTheme}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Theme
          </Button>
        </div>
        <div className="space-y-4">
          {identity.contentThemes.map((theme, idx) => (
            <ContentThemeCard
              key={idx}
              theme={theme}
              onUpdate={(updated) => updateContentTheme(idx, updated)}
              onDelete={() => removeContentTheme(idx)}
            />
          ))}
        </div>
      </Card>

      {/* Voice & Tone */}
      <Card className="mb-6 border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Voice & Tone</h2>
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-zinc-400">Caption Tone</label>
            <Textarea
              value={identity.captionTone}
              onChange={(e) => updateField("captionTone", e.target.value)}
              placeholder="How should captions sound?"
              className="mt-1 min-h-[60px] resize-none border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Caption Language & Style</label>
            <Textarea
              value={identity.captionLanguage}
              onChange={(e) => updateField("captionLanguage", e.target.value)}
              placeholder="Describe the language, sentence structure, and style..."
              className="mt-1 min-h-[60px] resize-none border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-zinc-400">Emoji Usage</label>
            <Input
              value={identity.emojiUsage}
              onChange={(e) => updateField("emojiUsage", e.target.value)}
              placeholder="e.g. 1-2 per caption max, subtle and contextual"
              className="mt-1 border-zinc-700 bg-zinc-900 text-zinc-100"
            />
          </div>
        </div>
      </Card>

      {/* Preferred Locations */}
      <Card className="mb-6 border-zinc-800 bg-zinc-900/50 p-6">
        <h2 className="mb-4 text-lg font-semibold text-zinc-100">Preferred Locations</h2>
        <p className="mb-4 text-sm text-zinc-400">
          When creating posts without a reference image, the AI will choose from these locations. Used for automated tasks to ensure location coherence.
        </p>
        <div className="space-y-2">
          {identity.preferredLocations.map((location, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input
                value={location}
                onChange={(e) => {
                  const updated = [...identity.preferredLocations];
                  updated[idx] = e.target.value;
                  updateField("preferredLocations", updated);
                }}
                placeholder="e.g. Bedroom, Beach, Travel: Europe"
                className="border-zinc-700 bg-zinc-900 text-zinc-100"
              />
              <button
                onClick={() => {
                  const updated = identity.preferredLocations.filter((_, i) => i !== idx);
                  updateField("preferredLocations", updated);
                }}
                className="text-zinc-500 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
          <Button
            size="sm"
            variant="outline"
            onClick={() => updateField("preferredLocations", [...identity.preferredLocations, ""])}
            className="mt-2 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            Add Location
          </Button>
        </div>
      </Card>

      {/* Variety Guidelines - Disabled for future */}
      <Card className="mb-6 border-zinc-700 bg-zinc-900/20 p-6 opacity-50">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-zinc-400">Variety Guidelines</h2>
            <p className="mt-1 text-xs text-zinc-500">
              Post variety automation — enabled in automated tasks (Part B). When tasks run, they'll check recent post history and ensure these rules are enforced (e.g., don't repeat the same style twice in a row).
            </p>
          </div>
        </div>
        <div className="space-y-2 pointer-events-none">
          {identity.varietyGuidelines.map((guide, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <Input
                value={guide}
                disabled
                placeholder="e.g. Vary the style mode..."
                className="border-zinc-800 bg-zinc-900/50 text-zinc-500"
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => setShowResetConfirm(true)}
          className="border-red-800/50 text-red-400 hover:bg-red-950/20"
        >
          Reset to Defaults
        </Button>
        <Button
          onClick={handleSave}
          disabled={!hasChanges}
          className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
        >
          Save Profile
        </Button>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={showResetConfirm} onOpenChange={setShowResetConfirm}>
        <DialogContent className="border-zinc-800 bg-zinc-900">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Reset to Defaults?</DialogTitle>
            <DialogDescription className="text-zinc-400">
              This will overwrite your entire identity profile with the default Alba profile. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetConfirm(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Reset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
