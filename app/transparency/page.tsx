"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { loadTransparency, DEFAULT_TRANSPARENCY, type TransparencyData } from "@/lib/transparency";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, RotateCcw, Save, Loader2, ChevronDown, ChevronRight } from "lucide-react";

type TabType = "ai-guides" | "gemini" | "fal" | "instagram" | "limits";

export default function TransparencyPage() {
  const guides = useQuery(api.aiGuides.get);
  const saveGuides = useMutation(api.aiGuides.save);
  const resetGuides = useMutation(api.aiGuides.reset);

  const [captionStyle, setCaptionStyle] = useState("");
  const [promptStyle, setPromptStyle] = useState("");
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("ai-guides");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [transparency, setTransparency] = useState<TransparencyData>(DEFAULT_TRANSPARENCY);

  // Load transparency data from localStorage
  useEffect(() => {
    const loaded = loadTransparency();
    setTransparency(loaded);
  }, []);

  // Sync from Convex query to local state
  if (guides && (captionStyle === "" || promptStyle === "")) {
    setCaptionStyle(guides.captionStyle);
    setPromptStyle(guides.promptStyle);
  }

  const handleCaptionStyleChange = (value: string) => {
    setCaptionStyle(value);
    setHasChanges(true);
  };

  const handlePromptStyleChange = (value: string) => {
    setPromptStyle(value);
    setHasChanges(true);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveGuides({ captionStyle, promptStyle });
      setHasChanges(false);
      toast.success("Guides saved!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save guides");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm("Reset to default guides? This cannot be undone.")) return;
    setIsSaving(true);
    try {
      const defaults = await resetGuides({});
      setCaptionStyle(defaults.captionStyle);
      setPromptStyle(defaults.promptStyle);
      setHasChanges(false);
      toast.success("Guides reset to defaults!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset guides");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  };

  if (!guides) {
    return (
      <div className="mx-auto max-w-6xl space-y-4 p-6">
        <p className="text-zinc-400">Loading guides...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">Transparency & Configuration</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Complete visibility into your AI Assistant Guides and system configuration
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-zinc-800 mb-6 overflow-x-auto">
        <button
          onClick={() => setActiveTab("ai-guides")}
          className={`px-4 py-2 whitespace-nowrap border-b-2 transition-colors ${
            activeTab === "ai-guides"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-zinc-400 hover:text-zinc-300"
          }`}
        >
          AI Guides
        </button>
        <button
          onClick={() => setActiveTab("gemini")}
          className={`px-4 py-2 whitespace-nowrap border-b-2 transition-colors ${
            activeTab === "gemini"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Gemini Config
        </button>
        <button
          onClick={() => setActiveTab("fal")}
          className={`px-4 py-2 whitespace-nowrap border-b-2 transition-colors ${
            activeTab === "fal"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-zinc-400 hover:text-zinc-300"
          }`}
        >
          FAL.ai Config
        </button>
        <button
          onClick={() => setActiveTab("instagram")}
          className={`px-4 py-2 whitespace-nowrap border-b-2 transition-colors ${
            activeTab === "instagram"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-zinc-400 hover:text-zinc-300"
          }`}
        >
          Instagram Config
        </button>
        <button
          onClick={() => setActiveTab("limits")}
          className={`px-4 py-2 whitespace-nowrap border-b-2 transition-colors ${
            activeTab === "limits"
              ? "border-violet-500 text-violet-400"
              : "border-transparent text-zinc-400 hover:text-zinc-300"
          }`}
        >
          System Limits
        </button>
      </div>

      {/* AI Guides Tab */}
      {activeTab === "ai-guides" && (
        <div className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">Caption Style Guide</h2>
              <div className="text-[10px] text-zinc-600 bg-zinc-900 px-2 py-1 rounded">
                Used in post editor
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              This guide is sent to the AI when you use the "AI Helper" button while editing captions. Customize it to maintain your preferred voice and tone.
            </p>
            <Textarea
              value={captionStyle}
              onChange={(e) => handleCaptionStyleChange(e.target.value)}
              className="min-h-[200px] border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-200"
              placeholder="Caption style guide..."
            />
          </div>

          <Separator className="bg-zinc-800" />

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-zinc-100">Image Prompt Style Guide</h2>
              <div className="text-[10px] text-zinc-600 bg-zinc-900 px-2 py-1 rounded">
                Used in post editor
              </div>
            </div>
            <p className="text-xs text-zinc-500">
              This guide is sent to the AI when you use the "Helper" button while editing image prompts.
            </p>
            <Textarea
              value={promptStyle}
              onChange={(e) => handlePromptStyleChange(e.target.value)}
              className="min-h-[200px] border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-200"
              placeholder="Image prompt style guide..."
            />
          </div>

          <Separator className="bg-zinc-800" />

          {/* Info Banner */}
          <div className="flex gap-3 rounded-lg border border-amber-800/30 bg-amber-950/20 p-3">
            <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-300/80">
              <p className="font-medium mb-1">How it works</p>
              <p>These guides are stored in Convex (your backend) and passed to Gemini along with your current caption/prompt and images when you click the AI Helper button. The AI uses them to understand your preferred style and tone.</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="mr-1.5 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
            <Button
              onClick={handleReset}
              disabled={isSaving}
              variant="outline"
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <RotateCcw className="mr-1.5 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </div>
      )}

      {/* Gemini Config Tab */}
      {activeTab === "gemini" && (
        <div className="space-y-4">
          <div>
            <button
              onClick={() => toggleSection("gemini-model")}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-700/30 transition-colors rounded"
            >
              {expandedSections["gemini-model"] ? (
                <ChevronDown className="h-4 w-4 text-violet-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-violet-400" />
              )}
              <span className="font-semibold text-zinc-100">Model</span>
            </button>
            {expandedSections["gemini-model"] && (
              <div className="px-3 pb-3 pl-10">
                <code className="text-xs text-zinc-300 bg-zinc-900 p-2 rounded block">
                  {transparency.geminiConfig.model}
                </code>
              </div>
            )}
          </div>

          <div>
            <button
              onClick={() => toggleSection("gemini-temps")}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-700/30 transition-colors rounded"
            >
              {expandedSections["gemini-temps"] ? (
                <ChevronDown className="h-4 w-4 text-violet-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-violet-400" />
              )}
              <span className="font-semibold text-zinc-100">Temperature Settings</span>
            </button>
            {expandedSections["gemini-temps"] && (
              <div className="px-3 pb-3 pl-10 space-y-2 text-xs text-zinc-400">
                <div><strong>Brainstorm:</strong> {transparency.geminiConfig.temperature.brainstorm}</div>
                <div><strong>Analyze Images:</strong> {transparency.geminiConfig.temperature.analyzeImages}</div>
                <div><strong>Expand Carousel:</strong> {transparency.geminiConfig.temperature.expandCarousel}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FAL Config Tab */}
      {activeTab === "fal" && (
        <div className="space-y-4">
          <div>
            <button
              onClick={() => toggleSection("fal-model")}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-700/30 transition-colors rounded"
            >
              {expandedSections["fal-model"] ? (
                <ChevronDown className="h-4 w-4 text-violet-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-violet-400" />
              )}
              <span className="font-semibold text-zinc-100">Model</span>
            </button>
            {expandedSections["fal-model"] && (
              <div className="px-3 pb-3 pl-10">
                <code className="text-xs text-zinc-300 bg-zinc-900 p-2 rounded block">
                  {transparency.falConfig.model}
                </code>
              </div>
            )}
          </div>

          <div>
            <button
              onClick={() => toggleSection("fal-sizes")}
              className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-700/30 transition-colors rounded"
            >
              {expandedSections["fal-sizes"] ? (
                <ChevronDown className="h-4 w-4 text-violet-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-violet-400" />
              )}
              <span className="font-semibold text-zinc-100">Available Image Sizes</span>
            </button>
            {expandedSections["fal-sizes"] && (
              <div className="px-3 pb-3 pl-10 space-y-1 text-xs text-zinc-400">
                {transparency.falConfig.availableImageSizes.map((size) => (
                  <div key={size}>{size}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Instagram Config Tab */}
      {activeTab === "instagram" && (
        <div className="space-y-4 text-xs text-zinc-400">
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-zinc-300 font-semibold mb-2">API Version</div>
              <code className="text-[10px] text-zinc-400">{transparency.instagramConfig.apiVersion}</code>
            </div>
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-zinc-300 font-semibold mb-2">Caption Max Length</div>
              <div className="text-[10px]">{transparency.instagramConfig.limits.captionMaxLength} characters</div>
            </div>
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-zinc-300 font-semibold mb-2">Max Hashtags</div>
              <div className="text-[10px]">{transparency.instagramConfig.limits.hashtagsMaxCount}</div>
            </div>
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-zinc-300 font-semibold mb-2">Post Types</div>
              <div className="text-[10px]">{transparency.instagramConfig.postTypes.join(", ")}</div>
            </div>
          </div>
        </div>
      )}

      {/* System Limits Tab */}
      {activeTab === "limits" && (
        <div className="space-y-4 text-xs text-zinc-400">
          <div className="grid grid-cols-2 gap-4">
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-zinc-300 font-semibold mb-2">Max Image File Size</div>
              <div className="text-[10px]">{transparency.systemLimits.maxImageFileSize}</div>
            </div>
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-zinc-300 font-semibold mb-2">Supported Formats</div>
              <div className="text-[10px]">{transparency.systemLimits.supportedImageFormats.join(", ")}</div>
            </div>
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-zinc-300 font-semibold mb-2">Carousel Max Slides</div>
              <div className="text-[10px]">{transparency.systemLimits.carouselMaxSlides}</div>
            </div>
            <div className="border border-zinc-800 rounded p-3">
              <div className="text-zinc-300 font-semibold mb-2">Carousel Min Slides</div>
              <div className="text-[10px]">{transparency.systemLimits.carouselMinSlides}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
