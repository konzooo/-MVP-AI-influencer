"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createEmptyPost, CreationMode, PostType } from "@/lib/types";
import { brainstormPost } from "@/lib/brainstorm";
import { savePost } from "@/lib/store";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import { ReferenceLibraryDialog } from "@/components/reference-library/ReferenceLibraryDialog";
import type { ReferenceImage } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles,
  Loader2,
  PenLine,
  Copy,
  ImageIcon,
  Library,
  PenTool,
} from "lucide-react";

const POST_TYPE_OPTIONS: { value: PostType; label: string; desc: string }[] = [
  { value: "single_image", label: "Single Image", desc: "Standard feed photo" },
  { value: "carousel", label: "Carousel", desc: "Multi-image swipe post" },
  { value: "reel_cover", label: "Reel Cover", desc: "Video thumbnail" },
  { value: "story", label: "Story", desc: "Vertical 9:16, 24h" },
];

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreating: (postId: string) => void;
  onPostCreated: (postId: string) => void;
}

export function CreatePostModal({
  open,
  onOpenChange,
  onPostCreating,
  onPostCreated,
}: CreatePostModalProps) {
  const [creationMode, setCreationMode] = useState<CreationMode | null>(null);
  const [postType, setPostType] = useState<PostType | null>(null);
  const [idea, setIdea] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

  const canSubmit =
    !!creationMode &&
    !!postType &&
    (creationMode === "manual" || idea.trim() || images.length > 0) &&
    !isLoading;

  const reset = () => {
    setCreationMode(null);
    setPostType(null);
    setIdea("");
    setImages([]);
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!creationMode || !postType) return;

    // Generate a temporary ID to show loading state
    const tempId = `temp-${Date.now()}`;
    onPostCreating(tempId);
    setIsLoading(true);

    try {
      console.log("[CreatePostModal] Starting create flow with mode:", creationMode);
      let newPost;
      if (creationMode === "manual") {
        newPost = createEmptyPost("manual", postType);
        savePost(newPost);
      } else {
        newPost = await brainstormPost({
          idea,
          images,
          creationMode,
          postType,
        });
      }

      console.log("[CreatePostModal] Create flow completed, post ID:", newPost.id);

      toast.success(
        creationMode === "manual"
          ? "Manual draft created!"
          : creationMode === "from_own_images"
          ? "Post created from your images!"
          : creationMode === "copy_post"
            ? "Post plan generated from reference!"
            : "Post plan generated!"
      );

      // Close creation modal and open post view
      reset();
      onOpenChange(false);
      onPostCreated(newPost.id);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Failed to create post";
      console.error("[CreatePostModal] Error:", errorMsg, err);
      toast.error(errorMsg);
      // Reset loading state but keep modal open for retry
      setIsLoading(false);
    }
  };

  const handleLibraryImagesSelected = async (selected: ReferenceImage[]) => {
    const libraryImages: string[] = [];
    for (const img of selected) {
      const referenceSrc = img.referencePath || img.imagePath;
      try {
        const res = await fetch(referenceSrc);
        const blob = await res.blob();
        const dataUri = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(blob);
        });
        libraryImages.push(dataUri);
      } catch {
        if (
          referenceSrc.startsWith("http://") ||
          referenceSrc.startsWith("https://")
        ) {
          libraryImages.push(referenceSrc);
        }
      }
    }
    setImages((prev) => [...prev, ...libraryImages]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && !isLoading) {
      reset();
    }
    onOpenChange(nextOpen);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="!w-[48rem] !max-w-[calc(100vw-2rem)] border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">
              Create Ad-hoc Post
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Step 1: Creation mode */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">
                Start with
              </label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    value: "from_scratch" as CreationMode,
                    icon: PenLine,
                    label: "Start from scratch",
                    desc: "Describe your idea, AI builds the plan",
                  },
                  {
                    value: "copy_post" as CreationMode,
                    icon: Copy,
                    label: "Copy from other post",
                    desc: "Upload a post to recreate with your character",
                  },
                  {
                    value: "from_own_images" as CreationMode,
                    icon: ImageIcon,
                    label: "Start with own image",
                    desc: "Upload your photos, AI adds caption & details",
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setCreationMode(opt.value)}
                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-all ${
                      creationMode === opt.value
                        ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                        creationMode === opt.value
                          ? "bg-violet-500/20 text-violet-400"
                          : "bg-zinc-800 text-zinc-500"
                      }`}
                    >
                      <opt.icon className="h-4 w-4" />
                    </div>
                    <div>
                      <p
                        className={`text-sm font-medium ${
                          creationMode === opt.value
                            ? "text-violet-300"
                            : "text-zinc-300"
                        }`}
                      >
                        {opt.label}
                      </p>
                      <p className="text-[10px] text-zinc-500">{opt.desc}</p>
                    </div>
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setCreationMode("manual")}
                className={`inline-flex items-center gap-1.5 pl-1 pt-1 text-xs italic transition-colors ${
                  creationMode === "manual"
                    ? "font-serif text-violet-300"
                    : "font-serif text-zinc-500 hover:text-zinc-300"
                }`}
              >
                <PenTool className="h-3 w-3" />
                manual
              </button>
            </div>

            {/* Step 2: Post type */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-400">
                Post type
              </label>
              <div className="flex gap-2">
                {POST_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setPostType(opt.value)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-center transition-all ${
                      postType === opt.value
                        ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
                        : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
                    }`}
                  >
                    <p
                      className={`text-sm font-medium ${
                        postType === opt.value
                          ? "text-violet-300"
                          : "text-zinc-300"
                      }`}
                    >
                      {opt.label}
                    </p>
                    <p className="text-[10px] text-zinc-500">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Step 3: Content */}
            {creationMode && postType && creationMode !== "manual" && (
              <div className="animate-in fade-in slide-in-from-top-2 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-4 duration-300">
                {/* Image upload (for copy_post and from_own_images) */}
                {(creationMode === "copy_post" ||
                  creationMode === "from_own_images") && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-zinc-400">
                        {creationMode === "copy_post"
                          ? "Source images to recreate"
                          : "Photo(s) for your post"}
                      </label>
                      {creationMode === "from_own_images" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setShowLibraryPicker(true)}
                          className="h-7 gap-1.5 border-zinc-700 text-xs text-zinc-400 hover:border-violet-600 hover:bg-violet-950/30 hover:text-violet-300"
                        >
                          <Library className="h-3 w-3" />
                          Choose from Library
                        </Button>
                      )}
                    </div>
                    <ImageDropZone
                      images={images}
                      onChange={setImages}
                      large
                      hint={
                        creationMode === "copy_post"
                          ? "Drag, paste, or click — add the post(s) you want to recreate"
                          : "Drag, paste, or click — add your photos"
                      }
                    />
                  </div>
                )}

                {/* Idea / notes text */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-zinc-400">
                    {creationMode === "from_scratch"
                      ? "Describe your idea"
                      : "Additional notes (optional)"}
                  </label>
                  <Textarea
                    value={idea}
                    onChange={(e) => setIdea(e.target.value)}
                    placeholder={
                      creationMode === "from_scratch"
                        ? "e.g. Beach selfie at sunset, golden hour vibes, casual summer outfit..."
                        : creationMode === "copy_post"
                          ? "e.g. Change the outfit to a red dress, make it more moody..."
                          : "e.g. Keep the caption casual and fun, mention the location..."
                    }
                    className={`resize-none border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600 ${
                      creationMode === "from_scratch"
                        ? "min-h-[100px]"
                        : "min-h-[70px]"
                    }`}
                  />
                </div>

                {/* Inspiration images (for from_scratch) */}
                {creationMode === "from_scratch" && (
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-400">
                      Inspiration images (optional)
                    </label>
                    <ImageDropZone
                      images={images}
                      onChange={setImages}
                      hint="Drag, paste, or click to add"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center justify-between">
              <p className="text-xs text-zinc-600">
                {creationMode === "manual"
                  ? "Create a blank draft and fill in the title, copy, prompts, and images yourself"
                  : creationMode === "copy_post"
                  ? "The AI will analyze the images and create a recreation plan"
                  : creationMode === "from_own_images"
                    ? "The AI will analyze your photos and generate caption & details"
                    : creationMode === "from_scratch"
                      ? "The AI will flesh out your idea into a complete post plan"
                      : "Select creation mode and post type to begin"}
              </p>
              <Button
                onClick={handleCreate}
                disabled={!canSubmit}
                className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Create Post
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ReferenceLibraryDialog
        open={showLibraryPicker}
        onOpenChange={setShowLibraryPicker}
        onImagesSelected={handleLibraryImagesSelected}
      />
    </>
  );
}
