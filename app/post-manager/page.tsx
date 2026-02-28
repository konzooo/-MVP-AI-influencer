"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { PostPlan, PostStatus } from "@/lib/types";
import { loadPosts, savePost } from "@/lib/store";
import { Send, Clock, ImageIcon } from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
import { PostDetail } from "@/components/post-manager/PostDetail";
import { toast } from "sonner";

export default function PostManagerPage() {
  return (
    <Suspense>
      <PostManagerContent />
    </Suspense>
  );
}

function PostManagerContent() {
  const [posts, setPosts] = useState<PostPlan[]>([]);
  const [selectedPost, setSelectedPost] = useState<PostPlan | null>(null);

  const searchParams = useSearchParams();

  const refreshPosts = useCallback(() => {
    const all = loadPosts();
    const visible = all.filter(
      (p) =>
        p.status === "ready" ||
        p.status === "publishing" ||
        p.status === "scheduled" ||
        p.status === "posted"
    );
    visible.sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    setPosts(visible);
  }, []);

  useEffect(() => {
    refreshPosts();
  }, [refreshPosts]);

  // Handle OAuth callback query params
  useEffect(() => {
    const igConnected = searchParams.get("ig_connected");
    const igError = searchParams.get("ig_error");

    if (igConnected === "true") {
      toast.success("Instagram account connected successfully!");
      window.history.replaceState({}, "", "/post-manager");
    } else if (igError) {
      toast.error(`Instagram connection failed: ${igError}`);
      window.history.replaceState({}, "", "/post-manager");
    }
  }, [searchParams]);

  const handlePostUpdate = (updatedPost: PostPlan) => {
    savePost(updatedPost);
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

  // Show detail view if a post is selected
  if (selectedPost) {
    return (
      <PostDetail
        post={selectedPost}
        onBack={() => setSelectedPost(null)}
        onUpdate={handlePostUpdate}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-100">Post Manager</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Review completed posts and schedule them for publishing.
        </p>
      </div>

      {posts.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-900">
            <Send className="h-7 w-7 text-zinc-600" />
          </div>
          <h3 className="mt-4 text-sm font-medium text-zinc-400">
            No Posts Ready
          </h3>
          <p className="mt-2 max-w-md text-xs leading-relaxed text-zinc-600">
            Posts will appear here once you&apos;ve generated and
            selected images in the Image Generation tab. You can then
            publish or schedule them to Instagram.
          </p>
          <div className="mt-6 flex items-center gap-4 text-[10px] text-zinc-600">
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Schedule posts
            </div>
            <div className="flex items-center gap-1">
              <Send className="h-3 w-3" />
              Auto-publish to Instagram
            </div>
          </div>
        </div>
      ) : (
        /* Post grid */
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => {
            const selectedImages = post.generatedImages.filter(
              (i) => i.selected
            );
            const displayImage = selectedImages[0] || post.generatedImages[0];

            return (
              <div
                key={post.id}
                onClick={() => setSelectedPost(post)}
                className="cursor-pointer overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900/30 transition-colors hover:bg-zinc-900/50 hover:border-zinc-700"
              >
                {/* Image */}
                <div className="aspect-square bg-zinc-900">
                  {displayImage ? (
                    <img
                      src={displayImage.url}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-zinc-700" />
                    </div>
                  )}
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center justify-between">
                    <p className="truncate text-sm font-medium text-zinc-200">
                      {post.title || "Untitled"}
                    </p>
                    <StatusBadge
                      status={post.status}
                      onStatusChange={(newStatus) =>
                        handleStatusChange(post.id, newStatus)
                      }
                    />
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-zinc-500">
                    {post.caption || post.description || "No caption"}
                  </p>
                  {post.hashtags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {post.hashtags.slice(0, 5).map((tag, i) => (
                        <span
                          key={i}
                          className="text-[10px] text-violet-400/60"
                        >
                          #{tag}
                        </span>
                      ))}
                      {post.hashtags.length > 5 && (
                        <span className="text-[10px] text-zinc-600">
                          +{post.hashtags.length - 5} more
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
