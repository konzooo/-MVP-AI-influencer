"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Copy, ChevronDown, ChevronRight } from "lucide-react";
import {
  loadTransparency,
  saveTransparency,
  DEFAULT_TRANSPARENCY,
  type TransparencyData,
} from "@/lib/transparency";

type TabType = "gemini" | "fal" | "instagram" | "limits";

export default function TransparencyPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<TransparencyData | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>("gemini");
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const loaded = loadTransparency();
    setData(loaded);
    setIsLoading(false);
  }, []);

  if (isLoading || !data) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <p className="text-zinc-400">Loading...</p>
      </div>
    );
  }

  const handleSave = () => {
    if (data) {
      saveTransparency(data);
      setIsEditMode(false);
      toast.success("Transparency configuration saved");
    }
  };

  const handleReset = () => {
    setData(DEFAULT_TRANSPARENCY);
    saveTransparency(DEFAULT_TRANSPARENCY);
    setIsEditMode(false);
    toast.success("Configuration reset to defaults");
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

  const SectionHeader = ({
    section,
    title,
  }: {
    section: string;
    title: string;
  }) => (
    <button
      onClick={() => toggleSection(section)}
      className="flex w-full items-center gap-3 p-3 text-left hover:bg-zinc-700/30 transition-colors rounded"
    >
      {expandedSections[section] ? (
        <ChevronDown className="h-4 w-4 text-violet-400" />
      ) : (
        <ChevronRight className="h-4 w-4 text-violet-400" />
      )}
      <span className="font-semibold text-zinc-100">{title}</span>
    </button>
  );

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-100">Transparency & Configuration</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Complete visibility into all AI prompts, API parameters, and system configuration
        </p>
        {data.lastUpdated && (
          <p className="mt-2 text-xs text-zinc-600">
            Prompts last updated: {data.lastUpdated}
          </p>
        )}
      </div>

      {/* Mode Toggle */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          {isEditMode ? (
            <span className="text-amber-400 font-medium">✎ Edit Mode</span>
          ) : (
            <span className="text-emerald-400 font-medium">👁 Read Mode</span>
          )}
        </div>
        <div className="flex gap-2">
          {isEditMode && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                className="border-red-800/50 text-red-400 hover:bg-red-950/20"
              >
                Reset to Defaults
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                Save Changes
              </Button>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsEditMode(!isEditMode)}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            {isEditMode ? "View Mode" : "Edit Mode"}
          </Button>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="mb-6 flex gap-2 border-b border-zinc-800 pb-3">
        {[
          { id: "gemini", label: "Gemini Prompts" },
          { id: "fal", label: "FAL.ai Config" },
          { id: "instagram", label: "Instagram API" },
          { id: "limits", label: "System Limits" },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as TabType)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "border-b-2 border-violet-500 text-violet-400"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "gemini" && (
        <div className="space-y-4">
          {/* Shared Preamble */}
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="preamble" title="Shared Preamble" />
            {expandedSections["preamble"] && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  This preamble is prepended to all Gemini prompts to establish the AI's role and quality
                  standards.
                </p>
                {isEditMode ? (
                  <Textarea
                    value={data.geminiPrompts.sharedPreamble}
                    onChange={(e) =>
                      setData({
                        ...data,
                        geminiPrompts: {
                          ...data.geminiPrompts,
                          sharedPreamble: e.target.value,
                        },
                      })
                    }
                    className="min-h-[120px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                  />
                ) : (
                  <div className="relative">
                    <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 whitespace-pre-wrap break-words overflow-x-auto max-h-[200px] overflow-y-auto">
                      {data.geminiPrompts.sharedPreamble}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(data.geminiPrompts.sharedPreamble)}
                      className="absolute top-2 right-2 p-2 hover:bg-zinc-900 rounded transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* From Scratch Prompt */}
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="fromscratch" title="From Scratch Prompt" />
            {expandedSections["fromscratch"] && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  Used when creating a post from scratch with a text idea and optional reference images.
                </p>
                {isEditMode ? (
                  <Textarea
                    value={data.geminiPrompts.fromScratchPrompt}
                    onChange={(e) =>
                      setData({
                        ...data,
                        geminiPrompts: {
                          ...data.geminiPrompts,
                          fromScratchPrompt: e.target.value,
                        },
                      })
                    }
                    className="min-h-[300px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                  />
                ) : (
                  <div className="relative">
                    <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 whitespace-pre-wrap break-words overflow-x-auto max-h-[300px] overflow-y-auto">
                      {data.geminiPrompts.fromScratchPrompt}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(data.geminiPrompts.fromScratchPrompt)}
                      className="absolute top-2 right-2 p-2 hover:bg-zinc-900 rounded transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Copy Post Prompt */}
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="copypost" title="Copy Post Prompt" />
            {expandedSections["copypost"] && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  Used when analyzing existing Instagram posts to recreate their vibe and atmosphere.
                </p>
                {isEditMode ? (
                  <Textarea
                    value={data.geminiPrompts.copyPostPrompt}
                    onChange={(e) =>
                      setData({
                        ...data,
                        geminiPrompts: {
                          ...data.geminiPrompts,
                          copyPostPrompt: e.target.value,
                        },
                      })
                    }
                    className="min-h-[300px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                  />
                ) : (
                  <div className="relative">
                    <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 whitespace-pre-wrap break-words overflow-x-auto max-h-[300px] overflow-y-auto">
                      {data.geminiPrompts.copyPostPrompt}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(data.geminiPrompts.copyPostPrompt)}
                      className="absolute top-2 right-2 p-2 hover:bg-zinc-900 rounded transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Analyze Own Images Prompt */}
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="analyze" title="Analyze Own Images Prompt" />
            {expandedSections["analyze"] && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  Used when uploading your own photos directly (not using them as inspiration or reference).
                </p>
                {isEditMode ? (
                  <Textarea
                    value={data.geminiPrompts.analyzeOwnImagesPrompt}
                    onChange={(e) =>
                      setData({
                        ...data,
                        geminiPrompts: {
                          ...data.geminiPrompts,
                          analyzeOwnImagesPrompt: e.target.value,
                        },
                      })
                    }
                    className="min-h-[250px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                  />
                ) : (
                  <div className="relative">
                    <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 whitespace-pre-wrap break-words overflow-x-auto max-h-[250px] overflow-y-auto">
                      {data.geminiPrompts.analyzeOwnImagesPrompt}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(data.geminiPrompts.analyzeOwnImagesPrompt)}
                      className="absolute top-2 right-2 p-2 hover:bg-zinc-900 rounded transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Expand Carousel Prompt */}
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="expand" title="Expand Carousel Prompt" />
            {expandedSections["expand"] && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  Used when expanding a single user image into a 4-slide carousel by generating 3 companion prompts.
                </p>
                {isEditMode ? (
                  <Textarea
                    value={data.geminiPrompts.expandCarouselPrompt}
                    onChange={(e) =>
                      setData({
                        ...data,
                        geminiPrompts: {
                          ...data.geminiPrompts,
                          expandCarouselPrompt: e.target.value,
                        },
                      })
                    }
                    className="min-h-[300px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                  />
                ) : (
                  <div className="relative">
                    <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 whitespace-pre-wrap break-words overflow-x-auto max-h-[300px] overflow-y-auto">
                      {data.geminiPrompts.expandCarouselPrompt}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(data.geminiPrompts.expandCarouselPrompt)}
                      className="absolute top-2 right-2 p-2 hover:bg-zinc-900 rounded transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Caption Helper Prompt */}
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="caption-helper" title="Caption Helper Prompt" />
            {expandedSections["caption-helper"] && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  Used when refining a caption in the post editor with the AI Helper button.
                </p>
                {isEditMode ? (
                  <Textarea
                    value={data.geminiPrompts.captionHelper}
                    onChange={(e) =>
                      setData({
                        ...data,
                        geminiPrompts: {
                          ...data.geminiPrompts,
                          captionHelper: e.target.value,
                        },
                      })
                    }
                    className="min-h-[250px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                  />
                ) : (
                  <div className="relative">
                    <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 whitespace-pre-wrap break-words overflow-x-auto max-h-[250px] overflow-y-auto">
                      {data.geminiPrompts.captionHelper}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(data.geminiPrompts.captionHelper)}
                      className="absolute top-2 right-2 p-2 hover:bg-zinc-900 rounded transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Prompt Helper Prompt */}
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="prompt-helper" title="Prompt Helper Prompt" />
            {expandedSections["prompt-helper"] && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <p className="text-xs text-zinc-400">
                  Used when refining an image prompt in the post editor with the Helper button.
                </p>
                {isEditMode ? (
                  <Textarea
                    value={data.geminiPrompts.promptHelper}
                    onChange={(e) =>
                      setData({
                        ...data,
                        geminiPrompts: {
                          ...data.geminiPrompts,
                          promptHelper: e.target.value,
                        },
                      })
                    }
                    className="min-h-[300px] border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs"
                  />
                ) : (
                  <div className="relative">
                    <pre className="bg-zinc-950 p-3 rounded text-xs text-zinc-300 whitespace-pre-wrap break-words overflow-x-auto max-h-[300px] overflow-y-auto">
                      {data.geminiPrompts.promptHelper}
                    </pre>
                    <button
                      onClick={() => copyToClipboard(data.geminiPrompts.promptHelper)}
                      className="absolute top-2 right-2 p-2 hover:bg-zinc-900 rounded transition-colors"
                    >
                      <Copy className="h-3.5 w-3.5 text-zinc-500 hover:text-zinc-300" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </Card>

          {/* Gemini Config */}
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="gemini-config" title="Gemini Configuration" />
            {expandedSections["gemini-config"] && (
              <div className="border-t border-zinc-800 p-4 space-y-3">
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Model</label>
                    <p className="text-zinc-300 font-mono mt-1">{data.geminiConfig.model}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Response Format</label>
                    <p className="text-zinc-300 font-mono mt-1">{data.geminiConfig.responseMimeType}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Temperature Settings</label>
                    <ul className="text-zinc-300 mt-1 space-y-1">
                      <li className="font-mono">
                        Brainstorm: <span className="text-emerald-400">{data.geminiConfig.temperature.brainstorm}</span>
                      </li>
                      <li className="font-mono">
                        Analyze Images:{" "}
                        <span className="text-emerald-400">{data.geminiConfig.temperature.analyzeImages}</span>
                      </li>
                      <li className="font-mono">
                        Expand Carousel:{" "}
                        <span className="text-emerald-400">{data.geminiConfig.temperature.expandCarousel}</span>
                      </li>
                    </ul>
                    <p className="text-xs text-zinc-500 mt-2">
                      Higher temperature = more creative/random. Lower = more consistent.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "fal" && (
        <div className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="fal-config" title="FAL.ai Configuration" />
            {expandedSections["fal-config"] && (
              <div className="border-t border-zinc-800 p-4 space-y-4">
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Model & API</label>
                    <p className="text-zinc-300 font-mono mt-1 text-xs">{data.falConfig.model}</p>
                    <p className="text-zinc-500 text-xs mt-1">
                      This is the Seedream v4.5 model used for image generation with reference image support.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400">Default Image Size</label>
                    <p className="text-zinc-300 font-mono mt-1">{data.falConfig.defaultImageSize}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400">Available Image Sizes</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {data.falConfig.availableImageSizes.map((size) => (
                        <span key={size} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono">
                          {size}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-2">Parameters</label>
                    <div className="space-y-2 font-mono text-xs">
                      {Object.entries(data.falConfig.parameters).map(([key, value]) => (
                        <div key={key} className="bg-zinc-950 p-2 rounded">
                          <div className="text-violet-400">{key}:</div>
                          <div className="text-zinc-400 ml-2">{value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "instagram" && (
        <div className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="ig-config" title="Instagram Graph API Configuration" />
            {expandedSections["ig-config"] && (
              <div className="border-t border-zinc-800 p-4 space-y-4">
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">API Version</label>
                    <p className="text-zinc-300 font-mono mt-1">{data.instagramConfig.apiVersion}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400">Post Types Supported</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {data.instagramConfig.postTypes.map((type) => (
                        <span
                          key={type}
                          className="px-3 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono"
                        >
                          {type}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-2">Limits</label>
                    <div className="space-y-2">
                      <div className="bg-zinc-950 p-2 rounded">
                        <div className="text-violet-400 font-mono text-xs">Caption Max Length</div>
                        <div className="text-zinc-400 ml-2 font-mono text-xs">
                          {data.instagramConfig.limits.captionMaxLength} characters
                        </div>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded">
                        <div className="text-violet-400 font-mono text-xs">Maximum Hashtags</div>
                        <div className="text-zinc-400 ml-2 font-mono text-xs">
                          {data.instagramConfig.limits.hashtagsMaxCount} hashtags
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        </div>
      )}

      {activeTab === "limits" && (
        <div className="space-y-4">
          <Card className="border-zinc-800 bg-zinc-900/50 overflow-hidden">
            <SectionHeader section="system-limits" title="System Limits & Constraints" />
            {expandedSections["system-limits"] && (
              <div className="border-t border-zinc-800 p-4 space-y-4">
                <div className="space-y-3 text-sm">
                  <div>
                    <label className="text-xs font-medium text-zinc-400">Max Image File Size</label>
                    <p className="text-zinc-300 mt-1">{data.systemLimits.maxImageFileSize}</p>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400">Supported Image Formats</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      {data.systemLimits.supportedImageFormats.map((format) => (
                        <span key={format} className="px-2 py-1 bg-zinc-800 text-zinc-300 rounded text-xs font-mono">
                          {format}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="text-xs font-medium text-zinc-400 block mb-2">Carousel Constraints</label>
                    <div className="space-y-2">
                      <div className="bg-zinc-950 p-2 rounded">
                        <div className="text-violet-400 font-mono text-xs">Minimum Slides</div>
                        <div className="text-zinc-400 ml-2 font-mono text-xs">{data.systemLimits.carouselMinSlides}</div>
                      </div>
                      <div className="bg-zinc-950 p-2 rounded">
                        <div className="text-violet-400 font-mono text-xs">Maximum Slides</div>
                        <div className="text-zinc-400 ml-2 font-mono text-xs">{data.systemLimits.carouselMaxSlides}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>

          {/* Additional Info Card */}
          <Card className="border-zinc-800 bg-zinc-900/50 p-4">
            <h3 className="font-semibold text-zinc-100 mb-3">About This Page</h3>
            <p className="text-sm text-zinc-400 leading-relaxed">
              This transparency page shows all AI prompts, API parameters, and system configuration used throughout
              the application. In edit mode, you can customize any of these values to change how the AI behaves. All
              changes are persisted to your browser's local storage and will apply to future content generation.
            </p>
          </Card>
        </div>
      )}
    </div>
  );
}
