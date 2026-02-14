"use client";

import { useState } from "react";
import { PostPlan, PostStatus, GeneratedImage } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, ChevronRight, GripVertical, Hash, Send } from "lucide-react";

interface PostDetailProps {
  post: PostPlan;
  onBack: () => void;
  onUpdate: (post: PostPlan) => void;
}

export function PostDetail({ post, onBack, onUpdate }: PostDetailProps) {
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

    // Reorder the selected images
    const newSelectedImages = [...selectedImages];
    const draggedItem = newSelectedImages[draggedIndex];
    newSelectedImages.splice(draggedIndex, 1);
    newSelectedImages.splice(index, 0, draggedItem);

    // Update the full generatedImages array to reflect new order
    const selectedIds = new Set(newSelectedImages.map((img) => img.id));
    const nonSelected = post.generatedImages.filter((img) => !selectedIds.has(img.id));
    const reordered = [...newSelectedImages, ...nonSelected];

    onUpdate({ ...post, generatedImages: reordered });
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-950 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="text-zinc-400 hover:text-zinc-200"
            >
              <ArrowLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">
                {post.title || "Untitled Post"}
              </h2>
              <p className="text-xs text-zinc-500">
                {selectedCount} of {post.generatedImages.length} images selected
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="border-zinc-700 text-xs text-zinc-400"
            >
              {post.postType.replace("_", " ")}
            </Badge>
            <StatusBadge
              status={post.status}
              onStatusChange={(newStatus) =>
                onUpdate({ ...post, status: newStatus })
              }
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto bg-zinc-950 p-6">
        <div className="mx-auto max-w-5xl space-y-6">
          {/* Post info */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h3 className="mb-3 text-xs font-medium text-zinc-400">Post Details</h3>

            {post.description && (
              <div className="mb-3">
                <p className="text-sm text-zinc-300">{post.description}</p>
              </div>
            )}

            {post.caption && (
              <div className="mb-3">
                <p className="text-xs font-medium text-zinc-500">Caption</p>
                <p className="mt-1 text-sm text-zinc-300">{post.caption}</p>
              </div>
            )}

            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {post.hashtags.map((tag, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs text-violet-400/80"
                  >
                    <Hash className="h-3 w-3" />
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Selected images (for posting) */}
          {selectedCount > 0 && (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-400">
                  Selected Images ({selectedCount})
                </h3>
                <p className="text-xs text-zinc-600">Drag to reorder</p>
              </div>

              <div className="flex gap-3 overflow-x-auto pb-2">
                {selectedImages.map((img, index) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="group relative shrink-0 cursor-move overflow-hidden rounded-lg border-2 border-violet-600 bg-zinc-900 transition-all hover:border-violet-500"
                    style={{ width: "180px" }}
                  >
                    <img
                      src={img.url}
                      alt=""
                      className="aspect-square w-full object-cover"
                    />

                    {/* Order badge */}
                    <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-xs font-semibold text-white">
                      {index + 1}
                    </div>

                    {/* Drag handle */}
                    <div className="absolute right-2 top-2 rounded bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100">
                      <GripVertical className="h-4 w-4 text-zinc-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* All generated images (collapsible) */}
          <Collapsible open={isAllImagesOpen} onOpenChange={setIsAllImagesOpen}>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
              <CollapsibleTrigger className="flex w-full items-center justify-between">
                <h3 className="text-xs font-medium text-zinc-400">
                  All Generated Images ({post.generatedImages.length})
                </h3>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-zinc-600">
                    Click to select/deselect
                  </p>
                  {isAllImagesOpen ? (
                    <ChevronDown className="h-4 w-4 text-zinc-500" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-zinc-500" />
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="mt-3">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {post.generatedImages.map((img) => (
                <div
                  key={img.id}
                  className="group relative cursor-pointer overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 transition-all hover:border-zinc-700"
                  onClick={() => handleToggleSelect(img.id)}
                >
                  <img
                    src={img.url}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />

                  {/* Overlay */}
                  <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 transition-all group-hover:bg-black/40">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                        <Checkbox checked={img.selected} className="h-3.5 w-3.5" />
                        <span className="text-[10px] text-zinc-300">
                          {img.selected ? "Selected" : "Select"}
                        </span>
                      </div>
                      {img.selected && (
                        <Badge className="bg-emerald-600 text-[9px] text-white">
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

          {/* Actions */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
            <h3 className="mb-3 text-xs font-medium text-zinc-400">Publishing</h3>
            <div className="flex items-center gap-3">
              <Button
                disabled
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                <Send className="mr-2 h-4 w-4" />
                Publish to Instagram
              </Button>
              <p className="text-xs text-zinc-600">
                Coming soon — Instagram API integration
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
