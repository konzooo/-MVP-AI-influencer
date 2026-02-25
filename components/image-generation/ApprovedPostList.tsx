"use client";

import { PostPlan, PostStatus } from "@/lib/types";
import { ImageIcon, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/status-badge";

interface ApprovedPostListProps {
  posts: PostPlan[];
  selectedId: string | null;
  onSelect: (post: PostPlan) => void;
  onStatusChange?: (postId: string, newStatus: PostStatus) => void;
}

export function ApprovedPostList({
  posts,
  selectedId,
  onSelect,
  onStatusChange,
}: ApprovedPostListProps) {
  if (posts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-4 text-center">
        <ImageIcon className="mb-3 h-8 w-8 text-zinc-700" />
        <p className="text-sm font-medium text-zinc-500">No approved posts</p>
        <p className="mt-1 text-xs text-zinc-600">
          Approve posts in Ideation to see them here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1 p-2">
      {posts.map((post) => {
        const isSelected = post.id === selectedId;
        const hasImages = post.generatedImages.some((i) => i.selected);
        const isGenerating = post.status === "generating";

        return (
          <button
            key={post.id}
            onClick={() => onSelect(post)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
              isSelected
                ? "bg-zinc-800 ring-1 ring-violet-600/50"
                : "hover:bg-zinc-800/50"
            )}
          >
            {/* Thumbnail */}
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-zinc-800">
              {hasImages ? (
                <img
                  src={
                    post.generatedImages.find((i) => i.selected)?.url ||
                    post.generatedImages[0]?.url
                  }
                  alt=""
                  className="h-10 w-10 rounded-md object-cover"
                />
              ) : isGenerating ? (
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
              ) : (
                <ImageIcon className="h-4 w-4 text-zinc-600" />
              )}
            </div>

            {/* Info */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-zinc-200">
                {post.title || "Untitled"}
              </p>
              <p className="mt-0.5 truncate text-[10px] text-zinc-500">
                {post.description || "No description"}
              </p>
              <div className="mt-1 flex items-center gap-1.5">
                <StatusBadge
                  status={post.status}
                  onStatusChange={
                    onStatusChange
                      ? (newStatus) => onStatusChange(post.id, newStatus)
                      : undefined
                  }
                  className="px-1.5 py-0"
                />
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
