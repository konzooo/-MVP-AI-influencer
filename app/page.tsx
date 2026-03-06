"use client";

import { useState, useMemo } from "react";
import { usePostStore } from "@/hooks/use-post-store";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import {
  DashboardFilters,
  DashboardFilterState,
  DEFAULT_FILTERS,
} from "@/components/dashboard/DashboardFilters";
import { PostList } from "@/components/dashboard/PostList";
import { CreatePostModal } from "@/components/dashboard/CreatePostModal";
import { PostViewModal } from "@/components/post-view/PostViewModal";

export default function DashboardPage() {
  const { posts } = usePostStore();
  const [filters, setFilters] = useState<DashboardFilterState>(DEFAULT_FILTERS);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [creatingPostId, setCreatingPostId] = useState<string | null>(null);

  const filteredPosts = useMemo(() => {
    let result = [...posts];

    // Filter by status
    if (filters.status !== "all") {
      result = result.filter((p) => p.status === filters.status);
    }

    // Filter by source
    if (filters.source === "adhoc") {
      result = result.filter((p) => !p.taskId);
    } else if (filters.source === "task") {
      result = result.filter((p) => !!p.taskId);
    }

    // Sort
    result.sort((a, b) => {
      const dateA = new Date(a[filters.sortBy]).getTime();
      const dateB = new Date(b[filters.sortBy]).getTime();
      return dateB - dateA;
    });

    return result;
  }, [posts, filters]);

  const handlePostCreated = (postId: string) => {
    // Clear loading state and open the post view
    setCreatingPostId(null);
    setSelectedPostId(postId);
    setShowCreateModal(false);
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4 p-6">
      <DashboardHeader
        postCount={posts.length}
        onCreatePost={() => setShowCreateModal(true)}
      />

      <DashboardFilters filters={filters} onChange={setFilters} />

      <PostList
        posts={filteredPosts}
        onPostClick={setSelectedPostId}
        isCreating={!!creatingPostId}
      />

      <CreatePostModal
        open={showCreateModal}
        onOpenChange={(open) => {
          setShowCreateModal(open);
          if (open) setCreatingPostId(null);
        }}
        onPostCreating={setCreatingPostId}
        onPostCreated={handlePostCreated}
      />

      <PostViewModal
        postId={selectedPostId}
        open={!!selectedPostId}
        onOpenChange={(open) => {
          if (!open) setSelectedPostId(null);
        }}
      />
    </div>
  );
}
