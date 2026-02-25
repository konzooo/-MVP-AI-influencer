"use client";

import { PostPlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ArrowLeft } from "lucide-react";
import { PublishingPanel } from "./PublishingPanel";
import { ContentPanel } from "./ContentPanel";

interface PostDetailProps {
  post: PostPlan;
  onBack: () => void;
  onUpdate: (post: PostPlan) => void;
}

export function PostDetail({ post, onBack, onUpdate }: PostDetailProps) {
  const selectedImages = post.generatedImages.filter((i) => i.selected);
  const selectedCount = selectedImages.length;

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

      {/* Two-column content */}
      <div className="flex flex-1 overflow-hidden bg-zinc-950">
        {/* Left: Publishing Panel (2/3) */}
        <div className="flex-[2] overflow-auto border-r border-zinc-800 p-6">
          <PublishingPanel post={post} onUpdate={onUpdate} />
        </div>

        {/* Right: Content Panel (1/3) */}
        <div className="flex-1 overflow-auto p-6">
          <ContentPanel post={post} onUpdate={onUpdate} />
        </div>
      </div>
    </div>
  );
}
