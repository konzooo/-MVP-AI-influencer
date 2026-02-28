"use client";

import { useState } from "react";
import { PostPlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  GripVertical,
  Hash,
  Pencil,
  Check,
  X,
  Sparkles,
} from "lucide-react";
import { CaptionHelperDialog } from "./CaptionHelperDialog";

interface ContentPanelProps {
  post: PostPlan;
  onUpdate: (post: PostPlan) => void;
}

export function ContentPanel({ post, onUpdate }: ContentPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [isAllImagesOpen, setIsAllImagesOpen] = useState(false);

  const selectedImages = post.generatedImages.filter((i) => i.selected);
  const selectedCount = selectedImages.length;

  const handleToggleSelect = (imageId: string) => {
    const updated = post.generatedImages.map((img) =>
      img.id === imageId ? { ...img, selected: !img.selected } : img
    );
    onUpdate({ ...post, generatedImages: updated });
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSelectedImages = [...selectedImages];
    const draggedItem = newSelectedImages[draggedIndex];
    newSelectedImages.splice(draggedIndex, 1);
    newSelectedImages.splice(index, 0, draggedItem);

    const selectedIds = new Set(newSelectedImages.map((img) => img.id));
    const nonSelected = post.generatedImages.filter(
      (img) => !selectedIds.has(img.id)
    );
    const reordered = [...newSelectedImages, ...nonSelected];

    onUpdate({ ...post, generatedImages: reordered });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  const selectedImageUrls = selectedImages.map((i) => i.url);

  return (
    <div className="space-y-4">
      {/* Post Details */}
      <PostDetailsCompact post={post} onUpdate={onUpdate} selectedImageUrls={selectedImageUrls} />

      {/* Selected Images */}
      {selectedCount > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-medium text-zinc-400">
              Selected ({selectedCount})
            </h3>
            <p className="text-[10px] text-zinc-600">Drag to reorder</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {selectedImages.map((img, index) => (
              <div
                key={img.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                className="group relative shrink-0 cursor-move overflow-hidden rounded-md border-2 border-violet-600 bg-zinc-900 transition-all hover:border-violet-500"
                style={{ width: "120px" }}
              >
                <img
                  src={img.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />
                <div className="absolute left-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-violet-600 text-[10px] font-semibold text-white">
                  {index + 1}
                </div>
                <div className="absolute right-1.5 top-1.5 rounded bg-black/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                  <GripVertical className="h-3 w-3 text-zinc-300" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Generated Images */}
      <Collapsible open={isAllImagesOpen} onOpenChange={setIsAllImagesOpen}>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <CollapsibleTrigger className="flex w-full items-center justify-between">
            <h3 className="text-xs font-medium text-zinc-400">
              All Images ({post.generatedImages.length})
            </h3>
            <div className="flex items-center gap-1.5">
              <p className="text-[10px] text-zinc-600">Click to select</p>
              {isAllImagesOpen ? (
                <ChevronDown className="h-3.5 w-3.5 text-zinc-500" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />
              )}
            </div>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-2">
            <div className="grid grid-cols-2 gap-2">
              {post.generatedImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative cursor-pointer overflow-hidden rounded-md border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700"
                  onClick={() => handleToggleSelect(img.id)}
                >
                  <img
                    src={img.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                  <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-1.5 transition-all group-hover:bg-black/40">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1 rounded bg-black/60 px-1 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Checkbox
                          checked={img.selected}
                          className="h-3 w-3"
                        />
                        <span className="text-[9px] text-zinc-300">
                          {img.selected ? "Selected" : "Select"}
                        </span>
                      </div>
                      {img.selected && (
                        <Badge className="bg-emerald-600 text-[8px] text-white">
                          Selected
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}

// ─── Compact Post Details (inline edit) ─────────────────────────────────────

function PostDetailsCompact({
  post,
  onUpdate,
  selectedImageUrls,
}: {
  post: PostPlan;
  onUpdate: (post: PostPlan) => void;
  selectedImageUrls: string[];
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(post.title);
  const [description, setDescription] = useState(post.description);
  const [caption, setCaption] = useState(post.caption);
  const [hashtagsText, setHashtagsText] = useState(post.hashtags.join(", "));
  const [captionHelperOpen, setCaptionHelperOpen] = useState(false);

  const handleSave = () => {
    onUpdate({
      ...post,
      title,
      description,
      caption,
      hashtags: hashtagsText
        .split(",")
        .map((t) => t.trim().replace(/^#/, ""))
        .filter(Boolean),
      updatedAt: new Date().toISOString(),
    });
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(post.title);
    setDescription(post.description);
    setCaption(post.caption);
    setHashtagsText(post.hashtags.join(", "));
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-zinc-400">Post Details</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="h-6 px-1.5 text-zinc-400"
            >
              <X className="h-3 w-3" />
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-6 gap-1 px-2"
            >
              <Check className="h-3 w-3" />
              Save
            </Button>
          </div>
        </div>

        <div>
          <label className="text-[10px] font-medium text-zinc-500">Title</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-0.5 h-8 text-xs"
            placeholder="Post title"
          />
        </div>

        <div>
          <label className="text-[10px] font-medium text-zinc-500">
            Description
          </label>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-0.5 min-h-16 text-xs"
            placeholder="Post description"
          />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-zinc-500">Caption</label>
            <button
              type="button"
              onClick={() => setCaptionHelperOpen(true)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-violet-400 hover:bg-violet-950/30 hover:text-violet-300 transition-colors"
            >
              <Sparkles className="h-2.5 w-2.5" />
              AI Helper
            </button>
          </div>
          <Textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            className="mt-0.5 min-h-16 text-xs"
            placeholder="Instagram caption"
          />
        </div>

        <CaptionHelperDialog
          open={captionHelperOpen}
          onOpenChange={setCaptionHelperOpen}
          currentCaption={caption}
          imageUrls={selectedImageUrls}
          onApplyCaption={(newCaption) => setCaption(newCaption)}
        />

        <div>
          <label className="text-[10px] font-medium text-zinc-500">
            Hashtags
          </label>
          <Input
            value={hashtagsText}
            onChange={(e) => setHashtagsText(e.target.value)}
            className="mt-0.5 h-8 text-xs"
            placeholder="tag1, tag2, tag3"
          />
          <p className="mt-0.5 text-[9px] text-zinc-600">
            Comma-separated, # optional
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-medium text-zinc-400">Post Details</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="h-6 gap-1 px-1.5 text-zinc-500 hover:text-zinc-300"
        >
          <Pencil className="h-2.5 w-2.5" />
          <span className="text-[10px]">Edit</span>
        </Button>
      </div>

      {post.title && (
        <p className="mb-1.5 text-sm font-medium text-zinc-200 leading-tight">
          {post.title}
        </p>
      )}

      {post.description && (
        <p className="mb-1.5 text-xs text-zinc-400 line-clamp-2">
          {post.description}
        </p>
      )}

      {post.caption && (
        <div className="mb-1.5">
          <p className="text-[10px] font-medium text-zinc-500">Caption</p>
          <p className="mt-0.5 text-xs text-zinc-300 line-clamp-3">
            {post.caption}
          </p>
        </div>
      )}

      {post.hashtags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {post.hashtags.map((tag, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-0.5 text-[10px] text-violet-400/80"
            >
              <Hash className="h-2.5 w-2.5" />
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
