"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  PostPlan,
  PostStatus,
  CreationMode,
  PostType,
  createEmptyPost,
} from "@/lib/types";
import { loadPosts, savePost, deletePost } from "@/lib/store";
import { IdeaInput } from "@/components/creative-lab/IdeaInput";
import { PostDetailView } from "@/components/creative-lab/PostDetailView";
import { DraftList } from "@/components/creative-lab/DraftList";
import { Separator } from "@/components/ui/separator";
import { loadIdentity, buildPersonaContext } from "@/lib/identity";

type View = "list" | "detail";

export default function CreativeLabPage() {
  const [posts, setPosts] = useState<PostPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // View state
  const [view, setView] = useState<View>("list");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [initialEditMode, setInitialEditMode] = useState(false);

  // Load posts on mount
  useEffect(() => {
    setPosts(loadPosts());
  }, []);

  const refreshPosts = useCallback(() => {
    setPosts(loadPosts());
  }, []);

  // Get the currently selected post from the posts list
  const selectedPost = selectedPostId
    ? posts.find((p) => p.id === selectedPostId) || null
    : null;

  // ─── Navigation helpers ──────────────────────────────────────────

  const navigateToDetail = (postId: string, editMode: boolean = false) => {
    setSelectedPostId(postId);
    setInitialEditMode(editMode);
    setView("detail");
  };

  const navigateToList = () => {
    setView("list");
    setSelectedPostId(null);
    setInitialEditMode(false);
    refreshPosts();
  };

  // ─── Generation ──────────────────────────────────────────────────

  const handleGenerate = async (
    idea: string,
    images: string[],
    creationMode: CreationMode,
    postType: PostType
  ) => {
    setIsLoading(true);

    // For from_own_images, we handle differently (no detail view loading state)
    // For brainstorm flows, switch to detail view with loading state immediately
    if (creationMode !== "from_own_images") {
      // Create a placeholder post and navigate to detail with loading
      setView("detail");
      setSelectedPostId(null); // Will be set when generation completes
      setInitialEditMode(true);
    }

    try {
      // Handle "from_own_images" differently
      if (creationMode === "from_own_images") {
        // Upload base64 images to fal storage to get persistent URLs
        const { uploadToFalStorageClient } = await import("@/lib/fal-client");
        const uploadedUrls: string[] = [];
        for (const img of images) {
          try {
            const url = await uploadToFalStorageClient(img);
            uploadedUrls.push(url);
          } catch (err) {
            console.error("Upload error:", err);
            uploadedUrls.push(img);
          }
        }

        // CAROUSEL: Use first image as slide 1, generate prompts for slides 2-4
        if (postType === "carousel") {
          // Switch to detail view with loading for carousel generation
          setView("detail");
          setSelectedPostId(null);
          setInitialEditMode(true);

          const identity = loadIdentity();
          const personaContext = identity.isActive ? buildPersonaContext(identity) : undefined;

          const expandResponse = await fetch("/api/expand-carousel", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image: images[0], notes: idea, personaContext }),
          });

          if (!expandResponse.ok) {
            const data = await expandResponse.json();
            throw new Error(data.error || "Failed to generate carousel plan");
          }

          const result = await expandResponse.json();

          const newPost = createEmptyPost("from_own_images", "carousel");
          newPost.title = result.title;
          newPost.description = result.description;
          newPost.caption = result.caption;
          newPost.hashtags = result.hashtags;
          newPost.notes = result.notes || "";
          newPost.status = "approved";

          // Image prompt 0 = empty (user's own image, no generation needed)
          // Image prompts 1-3 = AI-generated companion prompts, prefilled with user's image as reference
          newPost.imagePrompts = [
            { prompt: "", referenceImages: [] },
            ...(result.imagePrompts || []).map((ip: any) => ({
              prompt: ip.prompt || "",
              referenceImages: [uploadedUrls[0]],
            })),
          ];

          newPost.generatedImages = [{
            id: `own-${Date.now()}-0`,
            url: uploadedUrls[0],
            prompt: "User-provided image",
            selected: true,
            createdAt: new Date().toISOString(),
            promptIndex: 0,
            userProvided: true,
            settings: {
              imageSize: "portrait_4_3",
              numImages: 1,
              numVariations: 1,
              enableSafetyChecker: true,
            },
          }];

          newPost.referenceImages = images;

          savePost(newPost);
          refreshPosts();
          navigateToDetail(newPost.id, true);
          toast.success("Carousel plan created!");
          return;
        }

        // SINGLE IMAGE / STORY: Analyze and create ready post
        setView("detail");
        setSelectedPostId(null);
        setInitialEditMode(false);

        const identity = loadIdentity();
        const personaContext = identity.isActive ? buildPersonaContext(identity) : undefined;

        const response = await fetch("/api/analyze-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ images, notes: idea, personaContext }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to analyze images");
        }

        const result = await response.json();

        const newPost = createEmptyPost("from_own_images", result.postType || postType);
        newPost.title = result.title;
        newPost.description = result.description;
        newPost.caption = result.caption;
        newPost.hashtags = result.hashtags;
        newPost.postType = result.postType || postType;
        newPost.status = "ready";

        newPost.generatedImages = uploadedUrls.map((url, index) => ({
          id: `own-${Date.now()}-${index}`,
          url,
          prompt: "User-provided image",
          selected: true,
          createdAt: new Date().toISOString(),
          userProvided: true,
          settings: {
            imageSize: "portrait_4_3",
            numImages: 1,
            numVariations: 1,
            enableSafetyChecker: true,
          },
        }));

        savePost(newPost);
        refreshPosts();
        navigateToDetail(newPost.id, false);
        toast.success("Post created from your images!");
        return;
      }

      // Normal brainstorm flow for other modes
      const identity = loadIdentity();
      const personaContext = identity.isActive ? buildPersonaContext(identity) : undefined;

      const response = await fetch("/api/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea, images, creationMode, postType, personaContext }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate plan");
      }

      const plan = await response.json();

      const newPost = createEmptyPost(creationMode, postType);
      newPost.postType = postType;
      newPost.title = plan.title || "";
      newPost.description = plan.description || "";
      newPost.caption = plan.caption || "";
      newPost.hashtags = plan.hashtags || [];
      newPost.imagePrompts =
        plan.imagePrompts?.map((ip: any) => ({
          prompt: ip.prompt || "",
          referenceImages: [],
          referenceImageAnalysis: ip.referenceImageAnalysis,
        })) || newPost.imagePrompts;
      newPost.referenceImages = images;
      newPost.notes = plan.notes || "";

      if (postType === "story") {
        newPost.storyConfig = {
          duration: 5,
          textOverlay: plan.storyTextOverlay || plan.caption || "",
          linkUrl: plan.storyLinkUrl || "",
        };
      }

      savePost(newPost);
      refreshPosts();
      navigateToDetail(newPost.id, true);
      toast.success("Post plan generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate plan");
      // On error, go back to list if we were showing loading
      if (view === "detail" && !selectedPostId) {
        setView("list");
      }
    } finally {
      setIsLoading(false);
    }
  };

  // ─── List actions ────────────────────────────────────────────────

  const handleViewPost = (post: PostPlan) => {
    navigateToDetail(post.id, false);
  };

  const handleEditPost = (post: PostPlan) => {
    navigateToDetail(post.id, true);
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
    // If we're viewing the deleted post, go back to list
    if (selectedPostId === id) {
      navigateToList();
    }
  };

  const handleStatusChange = (id: string, newStatus: PostStatus) => {
    const post = posts.find((p) => p.id === id);
    if (!post) return;
    savePost({ ...post, status: newStatus });
    refreshPosts();
  };

  // ─── Detail view actions ─────────────────────────────────────────

  const handlePostUpdate = (updatedPost: PostPlan) => {
    refreshPosts();
  };

  const handleDetailApprove = (updatedPost: PostPlan) => {
    refreshPosts();
  };

  // ─── Render ──────────────────────────────────────────────────────

  // Detail view
  if (view === "detail") {
    return (
      <PostDetailView
        post={selectedPost}
        isLoading={isLoading}
        initialEditMode={initialEditMode}
        onBack={navigateToList}
        onPostUpdate={handlePostUpdate}
        onApprove={handleDetailApprove}
        onDelete={handleDeletePost}
        onStatusChange={handleStatusChange}
      />
    );
  }

  // List view
  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-100">Ideation</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Brainstorm post ideas, analyze reference images, and plan your
          content.
        </p>
      </div>

      {/* Input area */}
      <IdeaInput onGenerate={handleGenerate} isLoading={isLoading} />

      {/* Post list */}
      <Separator className="my-6 bg-zinc-800" />
      <div>
        <h3 className="mb-3 text-sm font-medium text-zinc-300">
          All Posts ({posts.length})
        </h3>
        <DraftList
          posts={posts}
          onView={handleViewPost}
          onEdit={handleEditPost}
          onApprove={handleApproveDraft}
          onDelete={handleDeletePost}
          onStatusChange={handleStatusChange}
        />
      </div>
    </div>
  );
}
