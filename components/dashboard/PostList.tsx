"use client";

import { PostPlan } from "@/lib/types";
import { StatusBadge } from "@/components/ui/status-badge";
import { Badge } from "@/components/ui/badge";
import {
  ImageIcon,
  Zap,
  Copy,
  UserRound,
  Sparkles,
  PenTool,
} from "lucide-react";

const CREATION_MODE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  manual: {
    label: "Manual",
    icon: <PenTool className="mr-0.5 h-2.5 w-2.5" />,
    className: "border-amber-800 bg-amber-950/40 text-amber-300",
  },
  copy_post: {
    label: "Copy",
    icon: <Copy className="mr-0.5 h-2.5 w-2.5" />,
    className: "border-blue-800 bg-blue-950/40 text-blue-400",
  },
  from_own_images: {
    label: "Own",
    icon: <UserRound className="mr-0.5 h-2.5 w-2.5" />,
    className: "border-emerald-800 bg-emerald-950/40 text-emerald-400",
  },
  from_scratch: {
    label: "Scratch",
    icon: <Sparkles className="mr-0.5 h-2.5 w-2.5" />,
    className: "border-zinc-700 bg-zinc-900/50 text-zinc-400",
  },
};

const POST_TYPE_LABELS: Record<string, string> = {
  single_image: "Image",
  carousel: "Carousel",
  reel_cover: "Reel",
  story: "Story",
};

interface PostListProps {
  posts: PostPlan[];
  onPostClick: (postId: string) => void;
  isCreating?: boolean;
}

export function PostList({ posts, onPostClick, isCreating }: PostListProps) {
  if (posts.length === 0 && !isCreating) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 py-12">
        <ImageIcon className="mb-3 h-8 w-8 text-zinc-700" />
        <p className="text-sm text-zinc-500">No posts yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Create an ad-hoc post or set up an automated task to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {isCreating && (
        <div className="flex items-center gap-3 rounded-lg border border-transparent bg-zinc-900/30 px-3 py-2.5 animate-pulse">
          <div className="h-10 w-10 shrink-0 rounded-md border border-zinc-800 bg-zinc-800" />
          <div className="min-w-0 flex-1">
            <p className="h-4 w-24 rounded bg-zinc-800" />
            <p className="mt-2 h-3 w-32 rounded bg-zinc-800" />
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <div className="h-5 w-12 rounded bg-zinc-800" />
            <div className="h-5 w-12 rounded bg-zinc-800" />
          </div>
        </div>
      )}
      {posts.map((post) => {
        const mode = CREATION_MODE_CONFIG[post.creationMode] ?? CREATION_MODE_CONFIG.from_scratch;
        const thumbnail = post.generatedImages.find((i) => i.selected)?.url;

        return (
          <div
            key={post.id}
            onClick={() => onPostClick(post.id)}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-transparent bg-zinc-900/30 px-3 py-2.5 transition-colors hover:border-zinc-800 hover:bg-zinc-900/60"
          >
            {/* Thumbnail */}
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-zinc-800 bg-zinc-900">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <ImageIcon className="h-4 w-4 text-zinc-700" />
                </div>
              )}
            </div>

            {/* Title + metadata */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-200">
                {post.title || "(untitled)"}
              </p>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-zinc-500">
                <span>
                  {new Date(post.createdAt).toLocaleDateString()}
                </span>
                {post.updatedAt !== post.createdAt && (
                  <span>
                    · Updated{" "}
                    {new Date(post.updatedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex shrink-0 items-center gap-1.5">
              <Badge
                className="bg-zinc-800 text-[9px] text-zinc-400 hover:bg-zinc-800"
              >
                {POST_TYPE_LABELS[post.postType] || post.postType}
              </Badge>
              <Badge
                variant="outline"
                className={`text-[9px] ${mode.className}`}
              >
                {mode.icon}
                {mode.label}
              </Badge>
              {post.taskId && (
                <Badge
                  variant="outline"
                  className="border-violet-800 bg-violet-950/30 text-[9px] text-violet-400"
                >
                  <Zap className="mr-0.5 h-2 w-2" />
                  Task
                </Badge>
              )}
              <StatusBadge status={post.status} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
