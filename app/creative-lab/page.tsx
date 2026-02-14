"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  PostPlan,
  PostStatus,
  CreationMode,
  PostType,
  createEmptyPost,
  GeneratedImage,
} from "@/lib/types";
import { loadPosts, savePost, deletePost } from "@/lib/store";
import { IdeaInput } from "@/components/creative-lab/IdeaInput";
import { PostPlanCard } from "@/components/creative-lab/PostPlanCard";
import { DraftList } from "@/components/creative-lab/DraftList";
import { Separator } from "@/components/ui/separator";

export default function CreativeLabPage() {
  const [posts, setPosts] = useState<PostPlan[]>([]);
  const [currentPlan, setCurrentPlan] = useState<PostPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Load posts on mount
  useEffect(() => {
    setPosts(loadPosts());
  }, []);

  const refreshPosts = useCallback(() => {
    setPosts(loadPosts());
  }, []);

  const handleGenerate = async (
    idea: string,
    images: string[],
    creationMode: CreationMode,
    postType: PostType
  ) => {
    setIsLoading(true);

    try {
      // Handle "from_own_images" differently - analyze and create ready post
      if (creationMode === "from_own_images") {
        const response = await fetch("/api/analyze-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images, notes: idea }), // Use 'idea' field for optional notes
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to analyze images");
        }

        const result = await response.json();

        // Upload base64 images to fal storage to get persistent URLs
        // (base64 data URIs are too large for localStorage)
        const uploadedUrls: string[] = [];
        for (const img of images) {
          const uploadResp = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dataUri: img }),
          });
          const uploadData = await uploadResp.json();
          uploadedUrls.push(uploadData.error ? img : uploadData.url);
        }

        // Create post directly with status "ready"
        const newPost = createEmptyPost("from_own_images", result.postType || postType);
        newPost.title = result.title;
        newPost.description = result.description;
        newPost.caption = result.caption;
        newPost.hashtags = result.hashtags;
        newPost.postType = result.postType || postType;
        newPost.status = "ready"; // Skip generation phase

        // Convert uploaded images to GeneratedImage format with selected=true
        newPost.generatedImages = uploadedUrls.map((url, index) => ({
          id: `own-${Date.now()}-${index}`,
          url,
          prompt: "User-provided image",
          selected: true,
          createdAt: new Date().toISOString(),
          settings: {
            imageSize: "square_hd",
            numImages: 1,
            numVariations: 1,
            enableSafetyChecker: true,
          },
        }));

        savePost(newPost);
        refreshPosts();
        toast.success("Post created from your images!");
        return;
      }

      // Normal brainstorm flow for other modes
      const response = await fetch("/api/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, images, creationMode, postType }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate plan");
      }

      const plan = await response.json();

      // Create a new PostPlan from the AI response
      const newPost = createEmptyPost(creationMode, postType);
      // Post type is set at creation and locked — use what user selected
      newPost.postType = postType;
      newPost.title = plan.title || "";
      newPost.description = plan.description || "";
      newPost.caption = plan.caption || "";
      newPost.hashtags = plan.hashtags || [];
      newPost.imagePrompts =
        plan.imagePrompts?.map((ip: any) => ({
          prompt: ip.prompt || "",
          referenceImages: [], // Will be set in Image Generation tab
          referenceImageAnalysis: ip.referenceImageAnalysis,
        })) || newPost.imagePrompts;
      newPost.referenceImages = images;
      newPost.notes = plan.notes || "";

      // Story-specific fields
      if (postType === "story") {
        newPost.storyConfig = {
          duration: 5,
          textOverlay: plan.storyTextOverlay || plan.caption || "",
          linkUrl: plan.storyLinkUrl || "",
        };
      }

      setCurrentPlan(newPost);
      toast.success("Post plan generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveDraft = () => {
    if (!currentPlan) return;
    const updated = { ...currentPlan, status: "draft" as const };
    savePost(updated);
    setCurrentPlan(null);
    refreshPosts();
  };

  const handleApprove = () => {
    if (!currentPlan) return;
    const updated = { ...currentPlan, status: "approved" as const };
    savePost(updated);
    setCurrentPlan(null);
    refreshPosts();
  };

  const handleDiscard = () => {
    setCurrentPlan(null);
  };

  const handleEditDraft = (post: PostPlan) => {
    setCurrentPlan(post);
  };

  const handleApproveDraft = (id: string) => {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    const updated = { ...post, status: "approved" as const };
    savePost(updated);
    refreshPosts();
  };

  const handleDeletePost = (id: string) => {
    deletePost(id);
    refreshPosts();
  };

  const handleStatusChange = (id: string, newStatus: PostStatus) => {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    savePost({ ...post, status: newStatus });
    refreshPosts();
  };

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-100">Creative Lab</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Brainstorm post ideas, analyze reference images, and plan your
          content.
        </p>
      </div>

      {/* Input area */}
      <IdeaInput onGenerate={handleGenerate} isLoading={isLoading} />

      {/* Generated plan */}
      {currentPlan && (
        <div className="mt-6">
          <PostPlanCard
            post={currentPlan}
            onChange={setCurrentPlan}
            onSaveDraft={handleSaveDraft}
            onApprove={handleApprove}
            onDiscard={handleDiscard}
          />
        </div>
      )}

      {/* Post list */}
      <Separator className="my-6 bg-zinc-800" />
      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">
          All Posts ({posts.length})
        </h3>
        <DraftList
          posts={posts}
          onEdit={handleEditDraft}
          onApprove={handleApproveDraft}
          onDelete={handleDeletePost}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  );
}
