"use client";

import { PostPlan, CreationMode, PostType, createEmptyPost } from "./types";
import { savePost } from "./store";
import { loadIdentity, buildPersonaContext } from "./identity";
import { loadAISettings, type AIProvider, type CarouselStyle } from "./ai-settings";
import { selectCharacterReference, buildContextFromKeywords } from "./reference-selector";
import { getLLMUsageFromHeaders, recordLLMCall } from "./cost-tracker";
import type { ReferenceImage } from "./types";

/**
 * Creates a new post by brainstorming/analyzing based on creation mode.
 * Returns the saved PostPlan.
 */
export async function brainstormPost(params: {
  idea: string;
  images: string[];
  creationMode: CreationMode;
  postType: PostType;
}): Promise<PostPlan> {
  const { idea, images, creationMode, postType } = params;

  console.log("[brainstormPost]", { creationMode, postType, numImages: images.length });

  const identity = loadIdentity();
  const personaContext = identity.isActive
    ? buildPersonaContext(identity)
    : undefined;
  const aiSettings = loadAISettings();

  if (creationMode === "from_own_images") {
    console.log("[brainstormPost] Starting from_own_images flow");
    return brainstormOwnImages({
      idea,
      images,
      postType,
      personaContext,
      carouselStyle: aiSettings.carouselStyle,
      analyzeImagesProvider: aiSettings.analyzeImages,
      expandCarouselProvider: aiSettings.expandCarousel,
    });
  }

  // Normal brainstorm flow (from_scratch or copy_post)
  const aiProvider =
    creationMode === "copy_post"
      ? aiSettings.brainstormCopyPost
      : aiSettings.brainstormFromScratch;

  const response = await fetch("/api/brainstorm", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      idea,
      images,
      creationMode,
      postType,
      personaContext,
      aiProvider,
      carouselStyle: aiSettings.carouselStyle,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to generate plan");
  }

  const aiProviderUsed = (response.headers.get("x-ai-provider") as typeof aiProvider | null) ?? aiProvider;
  const plan = await response.json();
  const usage = aiProviderUsed === "claude" ? getLLMUsageFromHeaders(response.headers) : undefined;
  recordLLMCall(aiProviderUsed, "brainstorm", usage?.cost ?? 0, usage);

  const newPost = createEmptyPost(creationMode, postType);
  newPost.postType = postType;
  newPost.title = plan.title || "";
  newPost.description = plan.description || "";
  newPost.caption = plan.caption || "";
  newPost.hashtags = plan.hashtags || [];
  newPost.imagePrompts =
    plan.imagePrompts?.map((ip: { prompt?: string; referenceImageAnalysis?: string }) => ({
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

  // Smart-select character reference from library
  if (creationMode === "from_scratch" || creationMode === "copy_post") {
    try {
      const refsRes = await fetch("/api/reference-images");
      if (refsRes.ok) {
        const { images: refs }: { images: ReferenceImage[] } = await refsRes.json();
        if (refs.length > 0) {
          const refContext = buildContextFromKeywords(
            [newPost.title, newPost.description, newPost.caption].filter(Boolean).join(" ")
          );
          const charRef = selectCharacterReference(refs, refContext);
          if (charRef) {
            newPost.selectedCharacterRefId = charRef.id;
            newPost.selectedCharacterRefPath = charRef.referencePath;
            newPost.characterRefs = [{ id: charRef.id, path: charRef.referencePath }];
            console.log("[brainstormPost] Smart-selected character reference:", charRef.id);
          }
        }
      }
    } catch (err) {
      console.warn("[brainstormPost] Failed to smart-select reference image:", err);
    }
  }

  savePost(newPost);
  return newPost;
}

/**
 * Upload base64 images to FAL storage via server-side API to get persistent URLs.
 * This avoids storing large base64 blobs in localStorage (which has a ~5MB limit).
 */
async function uploadImages(images: string[]): Promise<string[]> {
  const urls: string[] = [];
  for (const img of images) {
    if (!img.startsWith("data:")) {
      urls.push(img); // Already a URL
      continue;
    }
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUri: img }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      const { url } = await res.json();
      urls.push(url);
      console.log("[brainstorm] Uploaded image to FAL storage");
    } catch (err) {
      console.error("[brainstorm] Upload failed, keeping base64:", err);
      urls.push(img); // Fallback to base64 (may cause localStorage quota issues)
    }
  }
  return urls;
}

async function brainstormOwnImages(params: {
  idea: string;
  images: string[];
  postType: PostType;
  personaContext?: string;
  carouselStyle?: CarouselStyle;
  analyzeImagesProvider: AIProvider;
  expandCarouselProvider: AIProvider;
}): Promise<PostPlan> {
  const {
    idea,
    images,
    postType,
    personaContext,
    carouselStyle,
    analyzeImagesProvider,
    expandCarouselProvider,
  } = params;

  console.log("[brainstormOwnImages] Starting", { postType, numImages: images.length });

  // CAROUSEL: Use first image as slide 1, generate prompts for slides 2-3
  if (postType === "carousel") {
    console.log("[brainstormOwnImages] Processing carousel");
    const expandResponse = await fetch("/api/expand-carousel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: images[0],
        notes: idea,
        personaContext,
        carouselStyle,
        aiProvider: expandCarouselProvider,
      }),
    });

    if (!expandResponse.ok) {
      const data = await expandResponse.json();
      throw new Error(data.error || "Failed to generate carousel plan");
    }

    const providerUsed = (expandResponse.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? expandCarouselProvider;
    const result = await expandResponse.json();
    const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(expandResponse.headers) : undefined;
    recordLLMCall(providerUsed, "expand_carousel", usage?.cost ?? 0, usage);

    // Upload user image to FAL storage before saving (base64 is too large for localStorage)
    const uploadedUrls = await uploadImages([images[0]]);
    const ownImageRefId = `upload-own-${Date.now()}-0`;

    const newPost = createEmptyPost("from_own_images", "carousel");
    newPost.title = result.title;
    newPost.description = result.description;
    newPost.caption = result.caption;
    newPost.hashtags = result.hashtags;
    newPost.notes = result.notes || "";
    newPost.status = "draft";
    newPost.characterRefs = [{ id: ownImageRefId, path: uploadedUrls[0] }];
    newPost.selectedCharacterRefId = ownImageRefId;
    newPost.selectedCharacterRefPath = uploadedUrls[0];

    newPost.imagePrompts = [
      { prompt: "", referenceImages: [], referenceImageAnalysis: result.referenceImageAnalysis || "" }, // Slide 1: the user's uploaded image (stored in generatedImages)
      ...(result.imagePrompts || []).map(
        (ip: { prompt?: string }) => ({
          prompt: ip.prompt || "",
          referenceImages: [], // Companion slides auto-reference slide 1 via task-runner
        })
      ),
    ];

    newPost.generatedImages = [
      {
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
      },
    ];

    newPost.referenceImages = [];

    savePost(newPost);
    return newPost;
  }

  // SINGLE IMAGE / STORY: Analyze and create ready post
  const response = await fetch("/api/analyze-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      images,
      notes: idea,
      personaContext,
      aiProvider: analyzeImagesProvider,
    }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to analyze images");
  }

  const providerUsed = (response.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? analyzeImagesProvider;
  const result = await response.json();
  const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(response.headers) : undefined;
  recordLLMCall(providerUsed, "analyze_images", usage?.cost ?? 0, usage);

  // Upload user images to FAL storage before saving (base64 is too large for localStorage)
  const uploadedUrls = await uploadImages(images);

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
  return newPost;
}
