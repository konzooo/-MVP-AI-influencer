"use client";

import { useState } from "react";
import { PostPlan, PostType } from "@/lib/types";
import { InfoTooltip } from "@/components/image-generation/InfoTooltip";
import { tooltips } from "@/lib/tooltips";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Check,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  Eye,
  Copy,
} from "lucide-react";

interface PostPlanCardProps {
  post: PostPlan;
  onChange: (post: PostPlan) => void;
  onSaveDraft: () => void;
  onApprove: () => void;
  onDiscard: () => void;
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  single_image: "Single Image",
  carousel: "Carousel",
  reel_cover: "Reel Cover",
  story: "Story",
};

export function PostPlanCard({
  post,
  onChange,
  onSaveDraft,
  onApprove,
  onDiscard,
}: PostPlanCardProps) {
  const [expandedAnalysis, setExpandedAnalysis] = useState<
    Record<number, boolean>
  >({});

  const updateField = <K extends keyof PostPlan>(
    field: K,
    value: PostPlan[K]
  ) => {
    onChange({ ...post, [field]: value });
  };

  const updateHashtags = (value: string) => {
    const tags = value
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);
    updateField("hashtags", tags);
  };

  const updateImagePrompt = (index: number, prompt: string) => {
    const prompts = [...post.imagePrompts];
    prompts[index] = { ...prompts[index], prompt };
    updateField("imagePrompts", prompts);
  };

  const toggleAnalysis = (index: number) => {
    setExpandedAnalysis((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  const isCopyMode = post.creationMode === "copy_post";
  const isStory = post.postType === "story";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/50">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-5 py-3">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-zinc-100">
            Generated Post Plan
          </h3>
          <Badge
            variant="outline"
            className="border-zinc-700 bg-zinc-800/50 text-zinc-400"
          >
            {POST_TYPE_LABELS[post.postType]}
          </Badge>
          {isCopyMode && (
            <Badge
              variant="outline"
              className="border-blue-700 bg-blue-950/50 text-blue-400"
            >
              <Copy className="mr-1 h-3 w-3" />
              Copied
            </Badge>
          )}
        </div>
        <Badge
          variant="outline"
          className="border-amber-700 bg-amber-950/50 text-amber-400"
        >
          Draft
        </Badge>
      </div>

      <div className="space-y-4 p-5">
        {/* Title */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-400">Title</label>
          <Input
            value={post.title}
            onChange={(e) => updateField("title", e.target.value)}
            placeholder="e.g. Santorini sunset, full body, white linen dress"
            className="border-zinc-800 bg-zinc-900 text-zinc-100"
          />
        </div>

        {/* Description */}
        <div className="space-y-1">
          <label className="text-xs font-medium text-zinc-400">
            Description
          </label>
          <Textarea
            value={post.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="Brief description of the post concept"
            className="min-h-[60px] resize-none border-zinc-800 bg-zinc-900 text-zinc-100"
          />
        </div>

        {/* Caption */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-400">
              {isStory ? "Story Text Overlay" : "Instagram Caption"}
            </label>
            <InfoTooltip
              text={isStory ? tooltips.storyTextOverlay : tooltips.caption}
            />
          </div>
          <Textarea
            value={isStory ? post.storyConfig?.textOverlay || "" : post.caption}
            onChange={(e) => {
              if (isStory) {
                updateField("storyConfig", {
                  ...post.storyConfig,
                  textOverlay: e.target.value,
                });
              } else {
                updateField("caption", e.target.value);
              }
            }}
            placeholder={
              isStory
                ? "Short text overlay for the story..."
                : "The caption that will appear on Instagram..."
            }
            className="min-h-[80px] resize-none border-zinc-800 bg-zinc-900 text-zinc-100"
          />
        </div>

        {/* Hashtags (not for stories) */}
        {!isStory && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-400">
                Hashtags
              </label>
              <InfoTooltip text={tooltips.hashtags} />
            </div>
            <Input
              value={post.hashtags.map((h) => `#${h}`).join(" ")}
              onChange={(e) => updateHashtags(e.target.value)}
              placeholder="#aiinfluencer #lifestyle #photography"
              className="border-zinc-800 bg-zinc-900 text-zinc-100"
            />
            <div className="flex flex-wrap gap-1 pt-1">
              {post.hashtags.map((tag, i) => (
                <Badge
                  key={i}
                  variant="secondary"
                  className="bg-zinc-800 text-xs text-zinc-300"
                >
                  #{tag}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Story-specific: link URL */}
        {isStory && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-400">
                Link URL (optional)
              </label>
              <InfoTooltip text={tooltips.storyLink} />
            </div>
            <Input
              value={post.storyConfig?.linkUrl || ""}
              onChange={(e) =>
                updateField("storyConfig", {
                  ...post.storyConfig,
                  linkUrl: e.target.value,
                })
              }
              placeholder="https://..."
              className="border-zinc-800 bg-zinc-900 text-zinc-100"
            />
          </div>
        )}

        {/* Image Prompt(s) + Analysis */}
        {post.imagePrompts.map((ip, i) => (
          <div key={i} className="space-y-2">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-400">
                Image Generation Prompt{" "}
                {post.imagePrompts.length > 1 && `${i + 1}`}
              </label>
              <InfoTooltip text={tooltips.imagePrompt} />
            </div>
            <Textarea
              value={ip.prompt}
              onChange={(e) => updateImagePrompt(i, e.target.value)}
              placeholder="Detailed prompt for Seedream 4.5..."
              className="min-h-[80px] resize-none border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-100"
            />

            {/* Collapsible image analysis (copy mode only) */}
            {ip.referenceImageAnalysis && (
              <div className="rounded-md border border-zinc-800 bg-zinc-950/50">
                <div className="flex items-center gap-2 px-3 py-2">
                  <button
                    onClick={() => toggleAnalysis(i)}
                    className="flex flex-1 items-center gap-2 text-left text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-300"
                  >
                    {expandedAnalysis[i] ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <Eye className="h-3 w-3" />
                    Reference Image Analysis
                  </button>
                  <InfoTooltip text={tooltips.referenceImageAnalysis} />
                </div>
                {expandedAnalysis[i] && (
                  <div className="border-t border-zinc-800 px-3 py-2.5 text-xs leading-relaxed text-zinc-500 whitespace-pre-wrap">
                    {ip.referenceImageAnalysis}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Notes */}
        {post.notes && (
          <div className="space-y-1">
            <label className="text-xs font-medium text-zinc-400">
              AI Notes & Tips
            </label>
            <div className="rounded-md bg-zinc-800/50 p-3 text-xs leading-relaxed text-zinc-400">
              {post.notes}
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between border-t border-zinc-800 px-5 py-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          className="text-zinc-400 hover:text-red-400"
        >
          <X className="mr-1 h-3 w-3" />
          Discard
        </Button>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveDraft}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            <Save className="mr-1 h-3 w-3" />
            Save Draft
          </Button>
          <Button
            size="sm"
            onClick={onApprove}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            <Check className="mr-1 h-3 w-3" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
