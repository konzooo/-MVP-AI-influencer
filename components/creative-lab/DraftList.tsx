"use client";

import { PostPlan, PostType, PostStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Edit2, Trash2, ImageIcon, Copy } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";

interface DraftListProps {
  posts: PostPlan[];
  onView: (post: PostPlan) => void;
  onEdit: (post: PostPlan) => void;
  onApprove: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange?: (id: string, newStatus: PostStatus) => void;
}

const postTypeLabels: Record<PostType, string> = {
  single_image: "Image",
  carousel: "Carousel",
  reel_cover: "Reel",
  story: "Story",
};

export function DraftList({
  posts,
  onView,
  onEdit,
  onApprove,
  onDelete,
  onStatusChange,
}: DraftListProps) {
  if (posts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-800 p-8 text-center">
        <p className="text-sm text-zinc-500">
          No posts yet. Choose a creation mode and post type above to get
          started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => {
        const isCopy = post.creationMode === "copy_post";
        return (
          <div
            key={post.id}
            onClick={() => onView(post)}
            className="flex cursor-pointer items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900/30 px-4 py-3 transition-colors hover:bg-zinc-900/60"
          >
            {/* Thumbnail / icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-zinc-800">
              {post.generatedImages.length > 0 ? (
                <img
                  src={post.generatedImages[0].url}
                  alt=""
                  className="h-10 w-10 rounded-md object-cover"
                />
              ) : (
                <ImageIcon className="h-4 w-4 text-zinc-500" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">
                {post.title || "Untitled Post"}
              </p>
              <p className="truncate text-xs text-zinc-500">
                {post.description || "No description"}
              </p>
            </div>

            {/* Post type badge */}
            <Badge
              variant="outline"
              className="border-zinc-700 bg-zinc-800/50 text-[10px] text-zinc-500"
            >
              {postTypeLabels[post.postType]}
            </Badge>

            {/* Copy badge */}
            {isCopy && (
              <Badge
                variant="outline"
                className="border-blue-800 bg-blue-950/30 text-[10px] text-blue-500"
              >
                <Copy className="mr-0.5 h-2.5 w-2.5" />
                Copy
              </Badge>
            )}

            {/* Status */}
            <div onClick={(e) => e.stopPropagation()}>
              <StatusBadge
                status={post.status}
                onStatusChange={
                  onStatusChange
                    ? (newStatus) => onStatusChange(post.id, newStatus)
                    : undefined
                }
              />
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-500 hover:text-zinc-200"
                onClick={() => onEdit(post)}
                title="Edit"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              {post.status === "draft" && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-zinc-500 hover:text-emerald-400"
                  onClick={() => onApprove(post.id)}
                  title="Approve"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-zinc-500 hover:text-red-400"
                onClick={() => onDelete(post.id)}
                title="Delete"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
