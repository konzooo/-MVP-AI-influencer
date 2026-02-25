"use client";

import { useState, useEffect } from "react";
import { PostPlan, PostType, PostStatus } from "@/lib/types";
import { savePost } from "@/lib/store";
import { InfoTooltip } from "@/components/image-generation/InfoTooltip";
import { tooltips } from "@/lib/tooltips";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { Loader2, ArrowLeft, Pencil, Check, Save, Trash2, X, ChevronDown, ChevronRight, Eye, Copy } from "lucide-react";

interface PostDetailViewProps {
  post: PostPlan | null;
  isLoading: boolean;
  initialEditMode?: boolean;
  onBack: () => void;
  onPostUpdate: (post: PostPlan) => void;
  onApprove: (post: PostPlan) => void;
  onDelete: (id: string) => void;
  onStatusChange?: (id: string, newStatus: PostStatus) => void;
}

const POST_TYPE_LABELS: Record<PostType, string> = {
  single_image: "Single Image",
  carousel: "Carousel",
  reel_cover: "Reel Cover",
  story: "Story",
};

export function PostDetailView({
  post,
  isLoading,
  initialEditMode = false,
  onBack,
  onPostUpdate,
  onApprove,
  onDelete,
  onStatusChange,
}: PostDetailViewProps) {
  const [editMode, setEditMode] = useState(initialEditMode);
  const [editData, setEditData] = useState<PostPlan | null>(post);
  const [expandedAnalysis, setExpandedAnalysis] = useState<Record<number, boolean>>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Sync editData when post changes (e.g. after loading completes)
  useEffect(() => {
    setEditData(post);
    setHasUnsavedChanges(false);
  }, [post]);

  useEffect(() => {
    setEditMode(initialEditMode);
  }, [initialEditMode]);

  // ─── Loading state ───────────────────────────────────────────────
  if (isLoading && !post) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="mb-4 text-zinc-400 hover:text-zinc-200"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back
        </Button>
        <div className="flex h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
          <p className="text-sm text-zinc-400">Generating post plan...</p>
        </div>
      </div>
    );
  }

  if (!post || !editData) return null;

  const isCopyMode = post.creationMode === "copy_post";
  const isStory = post.postType === "story";

  // ─── Edit helpers ────────────────────────────────────────────────

  const updateField = <K extends keyof PostPlan>(field: K, value: PostPlan[K]) => {
    setEditData({ ...editData, [field]: value });
    setHasUnsavedChanges(true);
  };

  const updateHashtags = (value: string) => {
    const tags = value
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, "").trim())
      .filter(Boolean);
    updateField("hashtags", tags);
  };

  const updateImagePrompt = (index: number, prompt: string) => {
    const prompts = [...editData.imagePrompts];
    prompts[index] = { ...prompts[index], prompt };
    updateField("imagePrompts", prompts);
  };

  const handleSave = () => {
    savePost(editData);
    onPostUpdate(editData);
    setHasUnsavedChanges(false);
  };

  const handleApprove = () => {
    const updated = { ...editData, status: "approved" as const };
    savePost(updated);
    onApprove(updated);
    setEditData(updated);
    setHasUnsavedChanges(false);
  };

  const handleCancelEdit = () => {
    setEditData(post);
    setEditMode(false);
    setHasUnsavedChanges(false);
  };

  // ─── Render ──────────────────────────────────────────────────────

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="h-8 w-8 text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          {editMode ? (
            <Input
              value={editData.title}
              onChange={(e) => updateField("title", e.target.value)}
              placeholder="Post title..."
              className="h-8 max-w-md border-zinc-700 bg-zinc-900 text-lg font-semibold text-zinc-100"
            />
          ) : (
            <h2 className="text-lg font-semibold text-zinc-100">
              {post.title || "Untitled Post"}
            </h2>
          )}
        </div>

        <div className="flex items-center gap-2">
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
              Copy
            </Badge>
          )}
          <StatusBadge
            status={editData.status}
            onStatusChange={
              onStatusChange
                ? (newStatus) => onStatusChange(post.id, newStatus)
                : undefined
            }
          />
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setEditMode(!editMode)}
            className={`h-8 w-8 ${editMode ? "text-violet-400" : "text-zinc-500 hover:text-zinc-200"}`}
            title={editMode ? "Viewing mode" : "Edit mode"}
          >
            <Pencil className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-6 rounded-lg border border-zinc-800 bg-zinc-900/50 p-6">
        {/* Description */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-500">Description</label>
          {editMode ? (
            <Textarea
              value={editData.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Brief description of the post concept"
              className="min-h-[60px] resize-none border-zinc-800 bg-zinc-900 text-zinc-100"
            />
          ) : (
            <p className="text-sm leading-relaxed text-zinc-300">
              {post.description || <span className="text-zinc-600">No description</span>}
            </p>
          )}
        </div>

        {/* Caption */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-500">
              {isStory ? "Story Text Overlay" : "Instagram Caption"}
            </label>
            <InfoTooltip text={isStory ? tooltips.storyTextOverlay : tooltips.caption} />
          </div>
          {editMode ? (
            <Textarea
              value={isStory ? editData.storyConfig?.textOverlay || "" : editData.caption}
              onChange={(e) => {
                if (isStory) {
                  updateField("storyConfig", {
                    ...editData.storyConfig,
                    textOverlay: e.target.value,
                  });
                } else {
                  updateField("caption", e.target.value);
                }
              }}
              placeholder={isStory ? "Short text overlay for the story..." : "The caption that will appear on Instagram..."}
              className="min-h-[100px] resize-none border-zinc-800 bg-zinc-900 text-zinc-100"
            />
          ) : (
            <div className="whitespace-pre-wrap rounded-md bg-zinc-800/30 px-4 py-3 text-sm leading-relaxed text-zinc-300">
              {(isStory ? post.storyConfig?.textOverlay : post.caption) || (
                <span className="text-zinc-600">No caption</span>
              )}
            </div>
          )}
        </div>

        {/* Hashtags */}
        {!isStory && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500">Hashtags</label>
              <InfoTooltip text={tooltips.hashtags} />
            </div>
            {editMode ? (
              <>
                <Input
                  value={editData.hashtags.map((h) => `#${h}`).join(" ")}
                  onChange={(e) => updateHashtags(e.target.value)}
                  placeholder="#aiinfluencer #lifestyle #photography"
                  className="border-zinc-800 bg-zinc-900 text-zinc-100"
                />
                <div className="flex flex-wrap gap-1 pt-1">
                  {editData.hashtags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="bg-zinc-800 text-xs text-zinc-300">
                      #{tag}
                    </Badge>
                  ))}
                </div>
              </>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {post.hashtags.length > 0 ? (
                  post.hashtags.map((tag, i) => (
                    <Badge key={i} variant="secondary" className="bg-zinc-800 text-xs text-zinc-300">
                      #{tag}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-zinc-600">No hashtags</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Story link */}
        {isStory && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-zinc-500">Link URL (optional)</label>
              <InfoTooltip text={tooltips.storyLink} />
            </div>
            {editMode ? (
              <Input
                value={editData.storyConfig?.linkUrl || ""}
                onChange={(e) =>
                  updateField("storyConfig", {
                    ...editData.storyConfig,
                    linkUrl: e.target.value,
                  })
                }
                placeholder="https://..."
                className="border-zinc-800 bg-zinc-900 text-zinc-100"
              />
            ) : (
              <p className="text-sm text-zinc-300">
                {post.storyConfig?.linkUrl || <span className="text-zinc-600">No link</span>}
              </p>
            )}
          </div>
        )}

        {/* Image Prompts */}
        {editData.imagePrompts.map((ip, i) => {
          // Skip user-provided image prompts (empty prompt for locked images)
          const isUserProvided = post.generatedImages?.some(
            (img) => img.userProvided && img.promptIndex === i
          );
          if (isUserProvided) return null;

          return (
            <div key={i} className="space-y-2">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-zinc-500">
                  Image Prompt {editData.imagePrompts.length > 1 && `${i + 1}`}
                </label>
                <InfoTooltip text={tooltips.imagePrompt} />
              </div>
              {editMode ? (
                <Textarea
                  value={ip.prompt}
                  onChange={(e) => updateImagePrompt(i, e.target.value)}
                  placeholder="Detailed prompt for Seedream 4.5..."
                  className="min-h-[80px] resize-none border-zinc-800 bg-zinc-900 font-mono text-xs text-zinc-100"
                />
              ) : (
                <div className="rounded-md bg-zinc-800/30 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-400">
                  {ip.prompt || <span className="text-zinc-600">No prompt</span>}
                </div>
              )}

              {/* Collapsible analysis */}
              {ip.referenceImageAnalysis && (
                <div className="rounded-md border border-zinc-800 bg-zinc-950/50">
                  <button
                    onClick={() =>
                      setExpandedAnalysis((prev) => ({ ...prev, [i]: !prev[i] }))
                    }
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-300"
                  >
                    {expandedAnalysis[i] ? (
                      <ChevronDown className="h-3 w-3" />
                    ) : (
                      <ChevronRight className="h-3 w-3" />
                    )}
                    <Eye className="h-3 w-3" />
                    Reference Image Analysis
                  </button>
                  {expandedAnalysis[i] && (
                    <div className="whitespace-pre-wrap border-t border-zinc-800 px-3 py-2.5 text-xs leading-relaxed text-zinc-500">
                      {ip.referenceImageAnalysis}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* Notes */}
        {post.notes && (
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-500">AI Notes & Tips</label>
            <div className="rounded-md bg-zinc-800/30 px-4 py-3 text-xs leading-relaxed text-zinc-400">
              {post.notes}
            </div>
          </div>
        )}
      </div>

      {/* Action bar */}
      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onDelete(post.id)}
          className="text-zinc-500 hover:text-red-400"
        >
          <Trash2 className="mr-1 h-3.5 w-3.5" />
          Delete
        </Button>

        <div className="flex items-center gap-2">
          {editMode && hasUnsavedChanges && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancelEdit}
              className="text-zinc-400"
            >
              <X className="mr-1 h-3 w-3" />
              Cancel
            </Button>
          )}
          {editMode && hasUnsavedChanges && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSave}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              <Save className="mr-1 h-3.5 w-3.5" />
              Save
            </Button>
          )}
          {editData.status === "draft" && (
            <Button
              size="sm"
              onClick={handleApprove}
              className="bg-emerald-600 text-white hover:bg-emerald-700"
            >
              <Check className="mr-1 h-3.5 w-3.5" />
              Approve
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
