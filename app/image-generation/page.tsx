"use client";

import { useState, useEffect, useCallback } from "react";
import { PostPlan, PostStatus } from "@/lib/types";
import { loadPosts, savePost } from "@/lib/store";
import { ApprovedPostList } from "@/components/image-generation/ApprovedPostList";
import { GenerationWorkspace } from "@/components/image-generation/GenerationWorkspace";
import { createEmptyPost } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { ImageIcon, Plus } from "lucide-react";

export default function ImageGenerationPage() {
  const [posts, setPosts] = useState<PostPlan[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostPlan | null>(null);

  useEffect(() => {
    const all = loadPosts();
    const eligible = all.filter((p) =>
      ["approved", "generating", "ready"].includes(p.status)
    );
    setPosts(eligible);
  }, []);

  const refreshPosts = useCallback(() => {
    const all = loadPosts();
    const eligible = all.filter((p) =>
      ["approved", "generating", "ready"].includes(p.status)
    );
    setPosts(eligible);
  }, []);

  const handleSelectPost = (post: PostPlan) => {
    setSelectedPost(post);
  };

  const handlePostUpdate = (updatedPost: PostPlan) => {
    setSelectedPost(updatedPost);
    refreshPosts();
  };

  const handleStatusChange = (postId: string, newStatus: PostStatus) => {
    const post = posts.find((p) => p.id === postId);
    if (!post) return;
    const updated = { ...post, status: newStatus };
    savePost(updated);
    if (selectedPost?.id === postId) {
      setSelectedPost(updated);
    }
    refreshPosts();
  };

  const handleCreateNew = () => {
    const newPost = createEmptyPost("from_scratch", "single_image");
    newPost.status = "approved";
    newPost.title = "Quick Post";
    newPost.description = "Created directly in Image Generation";
    savePost(newPost);
    setSelectedPost(newPost);
    refreshPosts();
  };

  return (
    <div className="flex h-screen">
      {/* Left sidebar: post list */}
      <div className="flex w-72 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950">
        <div className="border-b border-zinc-800 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-zinc-100">
                Image Generation
              </h2>
              <p className="mt-0.5 text-[10px] text-zinc-500">
                {posts.length} post{posts.length !== 1 && "s"} awaiting images
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreateNew}
              className="h-7 gap-1 border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
              title="Create a new post directly here without planning in Ideation"
            >
              <Plus className="h-3 w-3" />
              New
            </Button>
          </div>
        </div>
        <div className="flex-1 overflow-auto">
          <ApprovedPostList
            posts={posts}
            selectedId={selectedPost?.id || null}
            onSelect={handleSelectPost}
            onStatusChange={handleStatusChange}
          />
        </div>
      </div>

      {/* Right: workspace */}
      <div className="flex-1 overflow-auto bg-zinc-950">
        {selectedPost ? (
          <GenerationWorkspace
            key={selectedPost.id}
            post={selectedPost}
            onPostUpdate={handlePostUpdate}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
              <ImageIcon className="h-7 w-7 text-zinc-600" />
            </div>
            <h3 className="mt-4 text-sm font-medium text-zinc-400">
              Select a post to start generating
            </h3>
            <p className="mt-1 max-w-sm text-xs text-zinc-600">
              Approve posts in Ideation first. Then select one from the
              list on the left to open the generation workspace.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
