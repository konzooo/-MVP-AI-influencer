"use client";

import { PostPlan, CreationMode, PostType, createEmptyPost } from "./types";
import { savePost } from "./store";
import { loadIdentity, buildPersonaContext } from "./identity";
import { loadAISettings } from "./ai-settings";

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
    return brainstormOwnImages({ idea, images, postType, personaContext, carouselStyle: aiSettings.carouselStyle });
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

  const plan = await response.json();

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
  carouselStyle?: string;
}): Promise<PostPlan> {
  const { idea, images, postType, personaContext, carouselStyle } = params;

  console.log("[brainstormOwnImages] Starting", { postType, numImages: images.length });

  // CAROUSEL: Use first image as slide 1, generate prompts for slides 2-3
  if (postType === "carousel") {
    console.log("[brainstormOwnImages] Processing carousel");
    const expandResponse = await fetch("/api/expand-carousel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: images[0], notes: idea, personaContext, carouselStyle }),
    });

    if (!expandResponse.ok) {
      const data = await expandResponse.json();
      throw new Error(data.error || "Failed to generate carousel plan");
    }

    const result = await expandResponse.json();

    // Upload user image to FAL storage before saving (base64 is too large for localStorage)
    const uploadedUrls = await uploadImages([images[0]]);

    const newPost = createEmptyPost("from_own_images", "carousel");
    newPost.title = result.title;
    newPost.description = result.description;
    newPost.caption = result.caption;
    newPost.hashtags = result.hashtags;
    newPost.notes = result.notes || "";
    newPost.status = "approved";

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
    body: JSON.stringify({ images, notes: idea, personaContext }),
  });

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || "Failed to analyze images");
  }

  const result = await response.json();

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
