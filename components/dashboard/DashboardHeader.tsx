"use client";

import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface DashboardHeaderProps {
  postCount: number;
  onCreatePost: () => void;
}

export function DashboardHeader({
  postCount,
  onCreatePost,
}: DashboardHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">Posts</h1>
        <p className="text-xs text-zinc-500">
          {postCount} {postCount === 1 ? "post" : "posts"}
        </p>
      </div>
      <Button
        onClick={onCreatePost}
        className="gap-1.5 bg-violet-600 text-white hover:bg-violet-700"
      >
        <Plus className="h-4 w-4" />
        Create Ad-hoc Post
      </Button>
    </div>
  );
}
