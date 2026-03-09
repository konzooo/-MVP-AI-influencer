"use client";

import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { PostPlan, GeneratedImage } from "@/lib/types";
import { savePostToConvex as savePost } from "@/lib/convex";
import { generatePostImages } from "@/lib/task-runner";
import { checkDailyLimit, recordGeneration } from "@/lib/cost-tracker";
import { canPublish, recordPublish } from "@/lib/instagram-rate-limit";
import { Task } from "@/lib/task-types";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuthToken } from "@convex-dev/auth/react";

export function usePostActions() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const persistImage = useAction(api.imageStorage.persistImage);
  const token = useAuthToken();

  /**
   * Approve a draft and start image generation via the server-side pipeline.
   * Used when generating with character references (task flow or from_scratch/copy_post).
   */
  const approveAndGenerate = useCallback(
    async (
      post: PostPlan,
      options?: {
        imageSize?: string;
        styleModeHint?: string;
        task?: Task | null;
      }
    ) => {
      const approved: PostPlan = {
        ...post,
        status: "approved",
        updatedAt: new Date().toISOString(),
      };
      savePost(approved);
      setIsGenerating(true);

      // Determine style mode hint from task inspiration item
      let styleModeHint = options?.styleModeHint;
      if (!styleModeHint && options?.task) {
        const item = options.task.inspirationItems.find(
          (i) => i.id === post.taskItemId
        );
        if (
          item?.type === "from_scratch" &&
          "preferredStyleMode" in item &&
          item.preferredStyleMode
        ) {
          styleModeHint = item.preferredStyleMode;
        }
      }

      const abortController = new AbortController();
      abortRef.current = abortController;

      const result = await generatePostImages(approved, {
        imageSize: options?.imageSize || "portrait_4_3",
        styleModeHint,
        signal: abortController.signal,
        persistImageUrl: async (url: string) => {
          const stored = await persistImage({ url, mimeType: "image/jpeg" });
          return stored.permanentUrl;
        },
      });

      abortRef.current = null;
      setIsGenerating(false);

      if (result.success) {
        toast.success("Images generated — post is ready for review");
      } else if (result.error !== "Generation stopped by user") {
        toast.error(`Generation failed: ${result.error}`);
      }

      return result;
    },
    []
  );

  /**
   * Regenerate a single slide using the client-side generation flow.
   * Takes the current prompt + reference images for that slide and calls /api/generate.
   */
  const regenerateSlide = useCallback(
    async (
      post: PostPlan,
      slideIndex: number,
      settings?: {
        imageSize?: string;
        numVariations?: number;
        seed?: string;
        enableSafetyChecker?: boolean;
      }
    ) => {
      const promptData = post.imagePrompts[slideIndex];
      if (!promptData?.prompt.trim()) {
        toast.warning("Please enter a prompt");
        return;
      }

      // Check cost limits
      const costCheck = checkDailyLimit();
      if (!costCheck.allowed) {
        toast.error(
          `Daily spend limit reached (€${costCheck.dailySpend.toFixed(2)} / €${costCheck.dailyStopLimit.toFixed(2)})`
        );
        return;
      }
      if (costCheck.warning) {
        toast.warning(
          `Approaching daily limit (€${costCheck.dailySpend.toFixed(2)} / €${costCheck.dailyStopLimit.toFixed(2)})`
        );
      }

      setIsGenerating(true);

      try {
        // Collect reference images — use character ref if stored, plus prompt-level refs
        const referenceUrls: string[] = [];

        // Add character reference if available
        if (post.selectedCharacterRefPath) {
          const { uploadToFalStorageClient } = await import(
            "@/lib/fal-client"
          );
          const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
          const localRefUrl = `${baseUrl}${post.selectedCharacterRefPath}`;
          try {
            const refRes = await fetch(localRefUrl);
            const blob = await refRes.blob();
            const reader = new FileReader();
            const base64 = await new Promise<string>((resolve) => {
              reader.onloadend = () => resolve(reader.result as string);
              reader.readAsDataURL(blob);
            });
            const uploaded = await uploadToFalStorageClient(base64);
            referenceUrls.push(uploaded);
          } catch {
            // If char ref upload fails, continue without it
          }
        }

        // Upload prompt-level reference images
        if (promptData.referenceImages.length > 0) {
          const { uploadToFalStorageClient } = await import(
            "@/lib/fal-client"
          );
          for (const img of promptData.referenceImages) {
            try {
              const url = await uploadToFalStorageClient(img);
              referenceUrls.push(url);
            } catch {
              referenceUrls.push(img);
            }
          }
        }

        if (referenceUrls.length === 0) {
          toast.warning("No reference images available for generation");
          setIsGenerating(false);
          return;
        }

        const imageSize = settings?.imageSize || "portrait_4_3";
        const numVariations = settings?.numVariations || 1;

        const allNewImages: GeneratedImage[] = [];

        for (let v = 0; v < numVariations; v++) {
          const resp = await fetch("/api/generate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: promptData.prompt,
              imageUrls: referenceUrls,
              imageSize,
              numImages: 1,
              maxImages: 1,
              seed: settings?.seed
                ? parseInt(settings.seed) + v
                : undefined,
              enableSafetyChecker: settings?.enableSafetyChecker ?? true,
            }),
          });

          const data = await resp.json();
          if (data.error) throw new Error(data.error);

          recordGeneration();

          if (data.images) {
            for (const img of data.images) {
              const actualSeed =
                img.seed ||
                (settings?.seed ? parseInt(settings.seed) + v : undefined);

              // Persist to Convex storage (FAL URLs expire in 7 days)
              let permanentUrl = img.url;
              try {
                const stored = await persistImage({ url: img.url, mimeType: "image/jpeg" });
                permanentUrl = stored.permanentUrl;
              } catch {
                // Fall back to FAL URL if persistence fails
              }

              allNewImages.push({
                id: crypto.randomUUID(),
                url: permanentUrl,
                prompt: promptData.prompt,
                seed: actualSeed,
                settings: {
                  imageSize,
                  seed: actualSeed,
                  numImages: 1,
                  numVariations,
                  enableSafetyChecker: settings?.enableSafetyChecker ?? true,
                },
                selected: false,
                createdAt: new Date().toISOString(),
                promptIndex: slideIndex,
              });
            }
          }
        }

        // Add new images, keep existing. Don't change status.
        const updatedPost: PostPlan = {
          ...post,
          generatedImages: [...allNewImages, ...post.generatedImages],
        };
        savePost(updatedPost);

        toast.success(
          `Generated ${allNewImages.length} image${allNewImages.length > 1 ? "s" : ""}`
        );
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Generation failed"
        );
      } finally {
        setIsGenerating(false);
      }
    },
    []
  );

  /**
   * Stop an in-progress generation.
   */
  const stopGeneration = useCallback((post: PostPlan) => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    const reset: PostPlan = {
      ...post,
      status: "draft",
      updatedAt: new Date().toISOString(),
    };
    savePost(reset);
    setIsGenerating(false);
    toast.info("Generation stopped — post reset to draft");
  }, []);

  /**
   * Publish a ready post to Instagram.
   */
  const publishToInstagram = useCallback(
    async (
      post: PostPlan,
      options?: { scheduledTime?: number }
    ) => {
      const selectedImages = post.generatedImages.filter((g) => g.selected);
      if (selectedImages.length === 0) {
        toast.error("No images selected for publishing");
        return;
      }

      if (!canPublish()) {
        toast.error("Daily post limit reached (25/25)");
        return;
      }

      setIsPublishing(true);

      const publishing: PostPlan = {
        ...post,
        status: "publishing",
        publishingInfo: { status: "publishing" },
      };
      savePost(publishing);

      try {
        const publishHeaders: Record<string, string> = { "Content-Type": "application/json" };
        if (token) publishHeaders["x-convex-auth"] = token;

        const res = await fetch("/api/instagram/publish", {
          method: "POST",
          headers: publishHeaders,
          body: JSON.stringify({
            imageUrls: selectedImages.map((img) => img.url),
            caption: post.caption,
            hashtags: post.hashtags,
            postType: post.postType,
            scheduledTime: options?.scheduledTime,
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          const failed: PostPlan = {
            ...post,
            status: "ready",
            publishingInfo: {
              status: "failed",
              error: data.error || "Publishing failed",
            },
          };
          savePost(failed);
          toast.error(data.error || "Publishing failed");
          return;
        }

        if (data.scheduled) {
          const scheduled: PostPlan = {
            ...post,
            status: "scheduled",
            publishingInfo: {
              status: "scheduled",
              igPostId: data.igPostId,
              scheduledFor: options?.scheduledTime
                ? new Date(options.scheduledTime * 1000).toISOString()
                : undefined,
            },
          };
          savePost(scheduled);
          toast.success("Post scheduled successfully!");
        } else {
          recordPublish();
          const posted: PostPlan = {
            ...post,
            status: "posted",
            publishingInfo: {
              status: "published",
              igPostId: data.igPostId,
              permalink: data.permalink,
              publishedAt: new Date().toISOString(),
            },
          };
          savePost(posted);
          toast.success("Published to Instagram!");
        }
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Network error";
        const failed: PostPlan = {
          ...post,
          status: "ready",
          publishingInfo: { status: "failed", error: message },
        };
        savePost(failed);
        toast.error(`Publishing failed: ${message}`);
      } finally {
        setIsPublishing(false);
      }
    },
    []
  );

  return {
    approveAndGenerate,
    regenerateSlide,
    stopGeneration,
    publishToInstagram,
    isGenerating,
    isPublishing,
  };
}
