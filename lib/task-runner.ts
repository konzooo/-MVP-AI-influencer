import {
  Task,
  InspirationItem,
  TaskRunResult,
  FromScratchInspirationItem,
} from "./task-types";
import {
  createEmptyPost,
  ImagePrompt,
  PostPlan,
  ReferenceImage,
} from "./types";
import { savePost } from "./store";
import { savePostAsync } from "./store-server";

/** Save post to Convex (awaited on server, fire-and-forget on client) */
async function savePostState(post: PostPlan): Promise<void> {
  if (isServer) {
    await savePostAsync(post);
  } else {
    savePost(post);
  }
}
import { loadIdentity } from "./identity";
import { loadIdentityAsync } from "./identity";
import {
  claimTaskRunAsync,
  saveTask,
  saveTaskAsync,
  computeNextRunAt,
} from "./task-store";
import {
  selectCharacterReference,
  buildContextFromStyleMode,
  buildContextFromKeywords,
  getSelectableCharacterReferences,
} from "./reference-selector";
import {
  checkDailyLimit,
  checkDailyLimitAsync,
  getLLMUsageFromHeaders,
  recordGeneration,
  recordGenerationAsync,
  recordLLMCall,
  recordLLMCallAsync,
} from "./cost-tracker";

import { loadAISettings } from "./ai-settings";
import { loadAISettingsAsync } from "./ai-settings";

const isServer = typeof window === "undefined";

/** Load identity from Convex (server) or localStorage (client) */
async function resolveIdentity() {
  return isServer ? loadIdentityAsync() : loadIdentity();
}

/** Load AI settings from Convex (server) or localStorage (client) */
async function resolveAISettings() {
  return isServer ? loadAISettingsAsync() : loadAISettings();
}

/** Record image generation cost (async on server, sync on client) */
async function resolveRecordGeneration() {
  if (isServer) {
    await recordGenerationAsync();
  } else {
    recordGeneration();
  }
}

/** Record LLM call (async on server, sync on client) */
async function resolveRecordLLMCall(
  ...args: Parameters<typeof recordLLMCall>
) {
  if (isServer) {
    await recordLLMCallAsync(...args);
  } else {
    recordLLMCall(...args);
  }
}

/** Check daily cost limit (async on server, sync on client) */
async function resolveCheckDailyLimit() {
  return isServer ? checkDailyLimitAsync() : checkDailyLimit();
}

/** Save task to Convex (async on server, fire-and-forget on client) */
async function resolveTaskSave(task: Task) {
  if (isServer) {
    await saveTaskAsync(task);
  } else {
    saveTask(task);
  }
}

interface ExecutionLog {
  lines: string[];
  add(msg: string): void;
}

function createLog(): ExecutionLog {
  return {
    lines: [],
    add(msg: string) {
      this.lines.push(msg);
      console.log(`[TaskRunner] ${msg}`);
    },
  };
}

type AIPlanPrompt = Partial<ImagePrompt>;
type AIPlan = {
  title?: string;
  description?: string;
  caption?: string;
  hashtags?: string[];
  imagePrompts?: AIPlanPrompt[];
  referenceImageAnalysis?: string;
  notes?: string;
  postType?: PostPlan["postType"];
  storyTextOverlay?: string;
  storyLinkUrl?: string;
};

function normalizePrompt(prompt: AIPlanPrompt = {}): ImagePrompt {
  return {
    prompt: prompt.prompt || "",
    negativePrompt: prompt.negativePrompt,
    referenceImages: prompt.referenceImages || [],
    referenceImageAnalysis: prompt.referenceImageAnalysis,
  };
}

function applyAiPlan(post: PostPlan, plan: AIPlan): void {
  post.postType = plan.postType || post.postType;
  post.title = plan.title || "";
  post.description = plan.description || "";
  post.caption = plan.caption || "";
  post.hashtags = Array.isArray(plan.hashtags) ? plan.hashtags : [];
  post.notes = plan.notes || "";

  if (Array.isArray(plan.imagePrompts)) {
    post.imagePrompts = plan.imagePrompts.map(normalizePrompt);
  }

  if (post.postType === "story") {
    post.storyConfig = {
      duration: post.storyConfig?.duration || 5,
      textOverlay: plan.storyTextOverlay || plan.caption || "",
      linkUrl: plan.storyLinkUrl || "",
    };
  }
}

function applyOwnImageCarouselPlan(post: PostPlan, plan: AIPlan): void {
  applyAiPlan(post, plan);

  const companionPrompts = Array.isArray(plan.imagePrompts)
    ? plan.imagePrompts.map(normalizePrompt)
    : [];

  if (companionPrompts.length === 2) {
    post.imagePrompts = [
      {
        prompt: "",
        referenceImages: [],
        referenceImageAnalysis: plan.referenceImageAnalysis || "",
      },
      ...companionPrompts,
    ];
    return;
  }

  if (companionPrompts.length === 0) {
    post.imagePrompts = [
      {
        prompt: "",
        referenceImages: [],
        referenceImageAnalysis: plan.referenceImageAnalysis || "",
      },
    ];
    return;
  }

  post.imagePrompts = companionPrompts.map((prompt, index) =>
    index === 0
      ? {
          ...prompt,
          referenceImageAnalysis:
            prompt.referenceImageAnalysis || plan.referenceImageAnalysis,
        }
      : prompt
  );
}

function getFilledImageForPrompt(post: PostPlan, promptIdx: number) {
  const isSinglePromptPost = post.imagePrompts.length === 1;

  const matches = post.generatedImages.filter((img) => {
    if (img.promptIndex === promptIdx) return true;
    if (isSinglePromptPost && promptIdx === 0 && img.promptIndex === undefined) {
      return true;
    }
    return false;
  });

  return (
    matches.find((img) => img.selected) ??
    matches.find((img) => img.userProvided) ??
    null
  );
}

function isOwnImageCarouselSeedSlide(post: PostPlan, promptIdx: number): boolean {
  if (
    post.creationMode !== "from_own_images" ||
    post.postType !== "carousel" ||
    promptIdx !== 0
  ) {
    return false;
  }

  const prompt = post.imagePrompts[promptIdx];
  const filledImage = getFilledImageForPrompt(post, promptIdx);
  return Boolean(filledImage?.userProvided) && !(prompt?.prompt ?? "").trim();
}

function getInternalApiBaseUrl(): string {
  if (typeof window !== "undefined") {
    return window.location.origin;
  }

  return (
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "http://localhost:3000"
  );
}

function getInternalApiUrl(path: string): string {
  return new URL(path, getInternalApiBaseUrl()).toString();
}

async function uploadImageSource(source: string): Promise<string> {
  const response = await fetch(getInternalApiUrl("/api/upload"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(
      source.startsWith("data:") ? { dataUri: source } : { src: source }
    ),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(data?.error || "Upload failed");
  }

  const data = await response.json();
  return data.url as string;
}

async function readApiError(response: Response): Promise<string> {
  const text = await response.text();

  try {
    const parsed = JSON.parse(text) as { error?: string; message?: string };
    return parsed.error || parsed.message || text;
  } catch {
    return text;
  }
}

// ─── Standalone generation function ──────────────────────────────────────────
// Can be called independently from the task runner (e.g. from the modal approve flow)

export interface GeneratePostResult {
  success: boolean;
  error: string | null;
  log: string[];
}

export async function generatePostImages(
  post: PostPlan,
  options: {
    imageSize: string;
    styleModeHint?: string;
    signal?: AbortSignal;
  }
): Promise<GeneratePostResult> {
  const log = createLog();
  const result: GeneratePostResult = { success: false, error: null, log: log.lines };
  let lastPromptFailure: string | null = null;

  const failGeneration = async (message: string): Promise<GeneratePostResult> => {
    result.error = message;
    post.status = "draft";
    post.generationError = message;
    post.generationRetryCount = (post.generationRetryCount || 0) + 1;
    log.add(`ERROR: ${message} (attempt ${post.generationRetryCount}/3)`);
    await savePostState(post);
    return result;
  };

  try {
    post.status = "generating";
    post.generationError = undefined;
    await savePostState(post);

    // Resolve character references — use stored refs if available, otherwise select fresh
    // For own-image posts: skip character ref entirely — slide 1 (user's photo) is the reference
    // Supports new multi-ref format (characterRefs[]) and legacy single ref
    let charRefPaths: { id: string; path: string }[] = [];
    const charRefUrls: string[] = [];

    if (post.creationMode === "from_own_images") {
      log.add("Own-image post — skipping character reference (will use slide 1 as reference)");
    } else if (post.characterRefs && post.characterRefs.length > 0) {
      charRefPaths = post.characterRefs;
      log.add(`Using ${charRefPaths.length} stored character reference(s): ${charRefPaths.map(r => r.id).join(", ")}`);
    } else if (post.selectedCharacterRefId && post.selectedCharacterRefPath) {
      // Legacy single ref
      charRefPaths = [{ id: post.selectedCharacterRefId, path: post.selectedCharacterRefPath }];
      log.add(`Using stored character reference (legacy): ${post.selectedCharacterRefId}`);
    } else {
      log.add(`No stored ref — fetching reference library...`);
      const refsRes = await fetch(getInternalApiUrl("/api/reference-images"));
      if (!refsRes.ok) {
        return failGeneration("Could not fetch reference library");
      }

      const refsData = await refsRes.json();
      const refs: ReferenceImage[] = refsData.images || [];
      const selectableRefs = getSelectableCharacterReferences(refs);
      if (selectableRefs.length === 0) {
        return failGeneration("No face-reference images available in library");
      }

      let refContext = buildContextFromStyleMode(post.title);
      if (options.styleModeHint) {
        refContext = buildContextFromStyleMode(options.styleModeHint);
      }

      const charRef = selectCharacterReference(selectableRefs, refContext);
      if (!charRef) {
        return failGeneration("Failed to select a face-reference image");
      }

      charRefPaths = [{ id: charRef.id, path: charRef.referencePath }];

      // Persist selection on the post so it's stable for future runs
      post.selectedCharacterRefId = charRef.id;
      post.selectedCharacterRefPath = charRef.referencePath;
      post.characterRefs = charRefPaths;
      await savePostState(post);

      log.add(`Selected character reference: ${charRef.id}`);
    }

    // Upload character references to fal storage (skipped for own-image posts)
    const baseUrl = getInternalApiBaseUrl();

    for (const ref of charRefPaths) {
      log.add(`Uploading character reference ${ref.id} to fal storage...`);
      try {
        const uploadSourcePath =
          ref.path.startsWith("/") && !ref.path.startsWith("//")
            ? `${baseUrl}${ref.path}`
            : ref.path;
        const uploadedUrl = await uploadImageSource(uploadSourcePath);
        charRefUrls.push(uploadedUrl);
        log.add(`Character reference uploaded: ${uploadedUrl.slice(0, 60)}...`);
      } catch (err) {
        return failGeneration(
          `Failed to upload character reference ${ref.id}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    // For carousels: track slide 0's generated URL for cascading
    let slide0GeneratedUrl: string | null = null;

    for (let promptIdx = 0; promptIdx < post.imagePrompts.length; promptIdx++) {
      // Check for cancellation
      if (options.signal?.aborted) {
        result.error = "Generation stopped by user";
        log.add("Generation stopped by user");
        post.status = "draft";
        post.generationError = undefined;
        await savePostState(post);
        return result;
      }

      const prompt = post.imagePrompts[promptIdx];

      const existingImage = getFilledImageForPrompt(post, promptIdx);
      if (existingImage) {
        if (post.postType === "carousel" && promptIdx === 0) {
          slide0GeneratedUrl = existingImage.url;
        }
        log.add(`Skipping slide ${promptIdx + 1} (already filled)`);
        continue;
      }

      log.add(`Generating images for prompt ${promptIdx + 1}/${post.imagePrompts.length}...`);

      // Check cost limit before generation
      const limit = await resolveCheckDailyLimit();
      if (!limit.allowed) {
        return failGeneration(
          `Daily generation limit exceeded (${limit.dailySpend}€ / ${limit.dailyStopLimit}€)`
        );
      }

      // Prepare reference URLs for this prompt
      // For carousel slides 2+: once slide 1 is generated, use it as the primary
      // consistency reference instead of the character ref — the generated image
      // already embeds the character's identity and the scene/outfit, so adding
      // the original character ref would introduce conflicting style signals.
      const isCarouselFollowSlide =
        post.postType === "carousel" && promptIdx > 0 && slide0GeneratedUrl !== null;
      const isOwnImageCarouselFollowSlide =
        post.creationMode === "from_own_images" &&
        post.postType === "carousel" &&
        promptIdx > 0;

      let referenceUrls: string[];
      if (isOwnImageCarouselFollowSlide) {
        // Own-image carousel: use slide 1 (the user's own photo) as the sole reference
        // for companion slides — same idea as the generated-carousel cascade below.
        const slide1 = getFilledImageForPrompt(post, 0);
        referenceUrls = slide1 ? [slide1.url] : [...charRefUrls];
        log.add(
          slide1
            ? `Slide ${promptIdx + 1}: using user's own slide 1 as reference`
            : `Slide ${promptIdx + 1}: slide 1 not found, falling back to character ref`
        );
      } else if (isCarouselFollowSlide) {
        // For generated carousels, slide 1 remains the sole follow-slide reference.
        referenceUrls = [slide0GeneratedUrl!];
        log.add(`Slide ${promptIdx + 1}: using slide 1 image as reference (dropping character ref for consistency)`);
      } else {
        // Slide 1 or single image: all character references
        referenceUrls = [...charRefUrls];
      }

      // Add per-prompt references
      if (prompt.referenceImages && prompt.referenceImages.length > 0) {
        for (const ref of prompt.referenceImages) {
          const uploadSourcePath =
            ref.startsWith("/") && !ref.startsWith("//")
              ? `${baseUrl}${ref}`
              : ref;
          const uploadedUrl = await uploadImageSource(uploadSourcePath);
          referenceUrls.push(uploadedUrl);
        }
      }

      try {
        const generateRes = await fetch(getInternalApiUrl("/api/generate"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.prompt,
            imageUrls: referenceUrls,
            imageSize: options.imageSize,
            numImages: 1,
            maxImages: 1,
            postId: post.id,
            postTitle: post.title,
            promptIndex: promptIdx,
          }),
          signal: options.signal,
        });

        if (!generateRes.ok) {
          const err = await readApiError(generateRes);
          lastPromptFailure = err;
          log.add(`WARNING: Generation failed for prompt ${promptIdx}: ${err}`);
          continue;
        }

        const genResult = await generateRes.json();
        if (!genResult.images || genResult.images.length === 0) {
          lastPromptFailure = "No images returned from generator";
          log.add(`WARNING: No images returned for prompt ${promptIdx}`);
          continue;
        }

        const img = genResult.images[0];
        const generatedImage = {
          id: img.id || `gen-${Date.now()}-${promptIdx}`,
          url: img.url,
          storageId: img.storageId,
          sourceUrl: img.sourceUrl,
          prompt: prompt.prompt,
          seed: img.seed,
          selected: true,
          createdAt: img.createdAt || new Date().toISOString(),
          promptIndex: promptIdx,
          settings: {
            imageSize: options.imageSize,
            numImages: 1,
            numVariations: 1,
            enableSafetyChecker: true,
          },
        };

        post.generatedImages.unshift(generatedImage);

        if (post.postType === "carousel" && promptIdx === 0) {
          slide0GeneratedUrl = img.url;
          log.add(`Slide 1 generated — will cascade as reference for remaining slides`);
        }

        log.add(`Generated image for prompt ${promptIdx + 1}`);
        await resolveRecordGeneration();

        // Save after each image so the UI can poll progress
        await savePostState(post);
      } catch (err) {
        // If aborted, stop immediately and reset to draft
        if (err instanceof DOMException && err.name === "AbortError") {
          result.error = "Generation stopped by user";
          log.add("Generation stopped by user");
          post.status = "draft";
          post.generationError = undefined;
          await savePostState(post);
          return result;
        }
        lastPromptFailure = err instanceof Error ? err.message : "Unknown error";
        log.add(
          `ERROR generating prompt ${promptIdx}: ${lastPromptFailure}`
        );
      }
    }

    const requiredPromptIndexes = post.imagePrompts
      .map((_, promptIdx) => promptIdx)
      .filter((promptIdx) => !isOwnImageCarouselSeedSlide(post, promptIdx));
    const filledRequiredPromptCount = requiredPromptIndexes.reduce((count, promptIdx) => {
      return count + (getFilledImageForPrompt(post, promptIdx) ? 1 : 0);
    }, 0);
    const generatedCount = post.generatedImages.filter((g) => !g.userProvided).length;

    if (filledRequiredPromptCount < requiredPromptIndexes.length) {
      // Partial completion (e.g. timeout): keep "generating" so the advancer
      // can resume on the next tick. Only reset to "draft" on complete failure.
      if (filledRequiredPromptCount > 0) {
        post.status = "generating";
        post.generationError = undefined;
        await savePostState(post);
        result.error = `Generation incomplete — ${filledRequiredPromptCount}/${requiredPromptIndexes.length} slides done (will resume)`;
        log.add(`PARTIAL: ${result.error}`);
      } else {
        return failGeneration(
          lastPromptFailure
            ? `Generation failed — ${lastPromptFailure}`
            : "Generation failed — no images produced"
        );
      }
      return result;
    }

    post.status = "ready";
    post.generationError = undefined;
    await savePostState(post);
    log.add(
      generatedCount > 0
        ? `Status: ready (${generatedCount} images generated)`
        : "Status: ready (all slides were already filled)"
    );

    result.success = true;
    return result;
  } catch (err) {
    // Handle abort at top level too
    if (err instanceof DOMException && err.name === "AbortError") {
      result.error = "Generation stopped by user";
      log.add("Generation stopped by user");
      post.status = "draft";
      post.generationError = undefined;
      await savePostState(post);
      return result;
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    log.add(`EXCEPTION: ${msg}`);
    return failGeneration(msg);
  }
}

/**
 * Main task execution engine
 *
 * Orchestrates the full pipeline from inspiration item selection through posting
 */
export async function runTask(
  task: Task,
  options?: {
    overrideItemId?: string;
    skipTaskLock?: boolean;
    manualTrigger?: boolean;
  }
): Promise<TaskRunResult> {
  const log = createLog();
  const result: TaskRunResult = {
    success: false,
    postId: null,
    error: null,
    usedItem: null,
    wasFallback: false,
    log: log.lines,
  };
  const runStartedAt = new Date().toISOString();

  const saveTaskOutcome = async (error: string | null) => {
    task.lastRunError = error;
    task.lastRunResultAt = new Date().toISOString();

    if (options?.manualTrigger) {
      task.lastRunAt = task.lastRunResultAt;
    }

    await resolveTaskSave(task);
  };

  const failTask = async (message: string) => {
    result.error = message;
    log.add(`ERROR: ${message}`);
    await saveTaskOutcome(message);
    return result;
  };

  try {
    log.add(`Starting task: "${task.name}"`);

    if (options?.skipTaskLock) {
      log.add(`Task already locked: nextRunAt advanced to ${task.nextRunAt}`);
    } else if (options?.manualTrigger) {
      log.add("Manual extra run requested — schedule unchanged");
    } else {
      const lastRunAt = runStartedAt;
      const nextRunAt = computeNextRunAt(task);
      const shouldClaimScheduledRun =
        task.status === "running" &&
        !!task.nextRunAt &&
        new Date(task.nextRunAt) <= new Date();

      if (shouldClaimScheduledRun) {
        const claimedTask = await claimTaskRunAsync(task, { lastRunAt, nextRunAt });
        if (!claimedTask) {
          result.error = "Task was already picked up by another run";
          log.add(`SKIP: ${result.error}`);
          return result;
        }
        task = claimedTask;
      } else {
        // Advance nextRunAt immediately so concurrent cron ticks don't pick up the same task.
        task.nextRunAt = nextRunAt;
        task.lastRunAt = lastRunAt;
        await resolveTaskSave(task);
      }

      log.add(`Locked task: nextRunAt advanced to ${task.nextRunAt}`);
    }

    // ─── Step 1: Select inspiration item ───────────────────────────────────────

    let selectedItem: InspirationItem | null = null;

    // If override specified, use that item
    if (options?.overrideItemId) {
      selectedItem =
        task.inspirationItems.find((i) => i.id === options.overrideItemId) || null;
      if (!selectedItem) {
        return failTask(`Item not found: ${options.overrideItemId}`);
      }
      log.add(`Using override item: ${options.overrideItemId}`);
    } else {
      // Find first pending item
      selectedItem = task.inspirationItems.find((i) => i.status === "pending") || null;

      if (!selectedItem) {
        // Queue empty — synthesize from_scratch item using task's fallback config
        log.add(`Queue empty, synthesizing from_scratch fallback item`);
        selectedItem = await synthesizeFromScratchItem(task);
        result.wasFallback = true;
      }
    }

    result.usedItem = selectedItem;
    log.add(`Selected item type: ${selectedItem.type}`);

    // ─── Step 2: Deduplicate — skip if a post already exists for this item ───

    if (!result.wasFallback) {
      try {
        const { loadPostsAsync } = await import("./store-server");
        const existingPosts = await loadPostsAsync();
        const duplicate = existingPosts.find(
          (p) => p.taskItemId === selectedItem!.id && p.taskId === task.id
        );
        if (duplicate) {
          await markItemUsed(task, selectedItem.id);
          log.add(
            `SKIP: post ${duplicate.id} already exists for item ${selectedItem.id}; marking queue item used`
          );
          result.success = true;
          result.postId = duplicate.id;
          await saveTaskOutcome(null);
          return result;
        }
      } catch (err) {
        log.add(`WARNING: Could not check for duplicate posts: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // ─── Step 3: Brainstorm / Analyze / Expand ────────────────────────────────

    let post: PostPlan;

    const identity = await resolveIdentity();
    const personaContext = identity.isActive
      ? (await import("./identity")).buildPersonaContext(identity)
      : undefined;
    const aiSettings = await resolveAISettings();

    if (selectedItem.type === "own_image") {
      if (selectedItem.postType === "carousel") {
        // POST /api/expand-carousel
        log.add(`Calling expand-carousel API for user image (using ${aiSettings.expandCarousel})...`);
        const expandRes = await fetch(getInternalApiUrl("/api/expand-carousel"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: selectedItem.imageUrls[0],
            notes: selectedItem.notes,
            personaContext,
            carouselStyle: aiSettings.carouselStyle,
            aiProvider: aiSettings.expandCarousel,
          }),
        });

        if (!expandRes.ok) {
          const err = await readApiError(expandRes);
          return failTask(`Expand carousel failed: ${err}`);
        }

        const providerUsed = (expandRes.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? aiSettings.expandCarousel;
        const expandPlan = await expandRes.json();
        const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(expandRes.headers) : undefined;
        await resolveRecordLLMCall(providerUsed, "expand_carousel", usage?.cost ?? 0, usage);
        post = createEmptyPost("from_own_images", "carousel");
        applyOwnImageCarouselPlan(post, expandPlan as AIPlan);
        post.status = "approved"; // needs generation for slides 2-3

        // No need to inject per-prompt references here — the generation loop
        // automatically uses slide 1's image (userProvided) as the sole reference
        // for companion slides via slide0GeneratedUrl cascading.

        log.add(
          `Expand carousel complete via ${providerUsed}: "${post.title}" with ${post.imagePrompts.length} prompts`
        );

        // Prepend user's image as first generated image (userProvided)
        post.generatedImages.unshift({
          id: `user-${Date.now()}`,
          url: selectedItem.imageUrls[0],
          prompt: "User provided image (carousel slide 1)",
          selected: true,
          createdAt: new Date().toISOString(),
          promptIndex: 0,
          userProvided: true,
          settings: {
            imageSize: task.defaultImageSize,
            numImages: 1,
            numVariations: 1,
            enableSafetyChecker: true,
          },
        });
      } else {
        // POST /api/analyze-images (single or story)
        log.add(`Calling analyze-images API for user image (using ${aiSettings.analyzeImages})...`);
        const analyzeRes = await fetch(getInternalApiUrl("/api/analyze-images"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: selectedItem.imageUrls,
            notes: selectedItem.notes,
            personaContext,
            aiProvider: aiSettings.analyzeImages,
          }),
        });

        if (!analyzeRes.ok) {
          const err = await readApiError(analyzeRes);
          return failTask(`Analyze images failed: ${err}`);
        }

        const providerUsed = (analyzeRes.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? aiSettings.analyzeImages;
        const analyzePlan = await analyzeRes.json();
        const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(analyzeRes.headers) : undefined;
        await resolveRecordLLMCall(providerUsed, "analyze_images", usage?.cost ?? 0, usage);
        post = createEmptyPost("from_own_images", selectedItem.postType);
        applyAiPlan(post, analyzePlan as AIPlan);
        post.status = "ready"; // skips generation — own images are final
        log.add(`Analyze complete via ${providerUsed}: "${post.title}"`);

        // Add user's images as generated images (userProvided)
        post.generatedImages = selectedItem.imageUrls.map((url, idx) => ({
          id: `user-${Date.now()}-${idx}`,
          url,
          prompt: "User provided image",
          selected: true,
          createdAt: new Date().toISOString(),
          promptIndex: idx,
          userProvided: true,
          settings: {
            imageSize: task.defaultImageSize,
            numImages: 1,
            numVariations: 1,
            enableSafetyChecker: true,
          },
        }));
      }
    } else if (selectedItem.type === "copy_post") {
      // POST /api/brainstorm (copy_post mode)
      log.add(`Calling brainstorm API in copy_post mode (using ${aiSettings.brainstormCopyPost})...`);
      const brainstormRes = await fetch(getInternalApiUrl("/api/brainstorm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: selectedItem.notes,
          images: selectedItem.imageUrls,
          creationMode: "copy_post",
          postType: selectedItem.postType,
          personaContext,
          aiProvider: aiSettings.brainstormCopyPost,
          carouselStyle: aiSettings.carouselStyle,
        }),
      });

      if (!brainstormRes.ok) {
        const err = await readApiError(brainstormRes);
        return failTask(`Brainstorm failed: ${err}`);
      }

      const providerUsed = (brainstormRes.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? aiSettings.brainstormCopyPost;
      const brainstormPlan = await brainstormRes.json();
      const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(brainstormRes.headers) : undefined;
      await resolveRecordLLMCall(providerUsed, "brainstorm", usage?.cost ?? 0, usage);
      post = createEmptyPost("copy_post", selectedItem.postType);
      applyAiPlan(post, brainstormPlan as AIPlan);
      post.status = "approved";
      log.add(
        `Brainstorm complete (copy_post via ${providerUsed}): "${post.title}" with ${post.imagePrompts.length} prompts`
      );
    } else {
      // from_scratch
      // POST /api/brainstorm (from_scratch mode)
      const idea = buildFromScratchIdea(
        selectedItem as FromScratchInspirationItem,
        identity
      );
      log.add(`Calling brainstorm API in from_scratch mode (using ${aiSettings.brainstormFromScratch})...`);
      const brainstormRes = await fetch(getInternalApiUrl("/api/brainstorm"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          images: [],
          creationMode: "from_scratch",
          postType: selectedItem.postType,
          personaContext,
          aiProvider: aiSettings.brainstormFromScratch,
          carouselStyle: aiSettings.carouselStyle,
        }),
      });

      if (!brainstormRes.ok) {
        const err = await readApiError(brainstormRes);
        return failTask(`Brainstorm failed: ${err}`);
      }

      const providerUsed = (brainstormRes.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? aiSettings.brainstormFromScratch;
      const brainstormPlan = await brainstormRes.json();
      const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(brainstormRes.headers) : undefined;
      await resolveRecordLLMCall(providerUsed, "brainstorm", usage?.cost ?? 0, usage);
      post = createEmptyPost("from_scratch", selectedItem.postType);
      applyAiPlan(post, brainstormPlan as AIPlan);
      post.status = "approved";
      log.add(
        `Brainstorm complete (from_scratch via ${providerUsed}): "${post.title}" with ${post.imagePrompts.length} prompts`
      );
    }

    // ─── Step 4: Attach task metadata + select character reference ─────────────

    post.taskId = task.id;
    post.taskItemId = selectedItem.id;

    // Select and persist character reference at draft creation time
    // (so it stays consistent across modal opens and generation)
    if (post.creationMode !== "from_own_images") {
      try {
        const refsRes = await fetch(getInternalApiUrl("/api/reference-images"));
        if (refsRes.ok) {
          const refsData = await refsRes.json();
          const refs: ReferenceImage[] = refsData.images || [];
          const selectableRefs = getSelectableCharacterReferences(refs);
          if (selectableRefs.length > 0) {
            let refContext;
            if (selectedItem.type === "from_scratch") {
              const item = selectedItem as FromScratchInspirationItem;
              refContext = item.preferredStyleMode
                ? buildContextFromStyleMode(item.preferredStyleMode)
                : buildContextFromKeywords([post.title, post.description].filter(Boolean).join(" "));
            } else {
              refContext = buildContextFromKeywords([post.title, post.description, post.caption].filter(Boolean).join(" "));
            }
            const charRef = selectCharacterReference(selectableRefs, refContext);
            if (charRef) {
              post.selectedCharacterRefId = charRef.id;
              post.selectedCharacterRefPath = charRef.referencePath;
              post.characterRefs = [{ id: charRef.id, path: charRef.referencePath }];
              log.add(`Character reference selected: ${charRef.id}`);
            }
          } else {
            log.add("WARNING: No face_reference images available for automatic selection");
          }
        }
      } catch (err) {
        log.add(`WARNING: Could not pre-select character reference: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // ─── Step 5: Save post first, then consume queue item ────────────────────
    // taskItemId dedupe protects retries if the queue update fails.
    await savePostState(post);
    await markItemUsed(task, selectedItem.id);
    log.add(`Post saved, item "${selectedItem.id}" marked used`);

    // ─── Step 6: Done ─────────────────────────────────────────────────────────
    // The unified automation runner advances task-linked posts one step at a
    // time while the task remains running.

    log.add(`Post created at status "${post.status}"`);
    if (task.nextRunAt) {
      log.add(`Next run scheduled: ${task.nextRunAt}`);
    }
    result.success = true;
    result.postId = post.id;
    await saveTaskOutcome(null);
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    log.add(`EXCEPTION: ${msg}`);
    return failTask(msg);
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function synthesizeFromScratchItem(task: Task): Promise<FromScratchInspirationItem> {
  const identity = await resolveIdentity();

  // Pick style mode randomly from identity
  const styleMode =
    identity.styleModes[Math.floor(Math.random() * identity.styleModes.length)]?.name || null;

  // Pick location using weighted selection from task config, or random from identity
  let location: string | null = null;
  if (task.fallbackLocations && task.fallbackLocations.length > 0) {
    location = weightedRandomPick(task.fallbackLocations);
  } else if (identity.preferredLocations.length > 0) {
    location = identity.preferredLocations[Math.floor(Math.random() * identity.preferredLocations.length)];
  }

  // Build notes from task's fallback notes
  const notes = task.fallbackNotes
    ? `${task.fallbackNotes}\n\nFallback: ${styleMode || "Auto"} at ${location || "Auto location"}`
    : `Fallback: ${styleMode || "Auto"} at ${location || "Auto location"}`;

  return {
    id: `fallback-${Date.now()}`,
    type: "from_scratch",
    status: "pending",
    notes,
    usedAt: null,
    preferredStyleMode: styleMode,
    preferredLocation: location,
    postType: task.defaultPostType,
  };
}

/**
 * Weighted random selection from fallback locations
 * Higher weight = higher probability of being selected
 */
function weightedRandomPick(locations: Task["fallbackLocations"]): string {
  const totalWeight = locations.reduce((sum, l) => sum + l.weight, 0);
  let random = Math.random() * totalWeight;
  for (const loc of locations) {
    random -= loc.weight;
    if (random <= 0) return loc.location;
  }
  return locations[locations.length - 1].location;
}

function buildFromScratchIdea(
  item: FromScratchInspirationItem,
  identity: ReturnType<typeof loadIdentity>
): string {
  let idea = item.notes;

  if (item.preferredStyleMode) {
    const styleMode = identity.styleModes.find((s) => s.name === item.preferredStyleMode);
    if (styleMode) {
      idea += `\n\nStyle: ${styleMode.description}`;
    }
  }

  if (item.preferredLocation) {
    idea += `\n\nLocation: ${item.preferredLocation}`;
  }

  return idea;
}

async function markItemUsed(task: Task, itemId: string): Promise<void> {
  const item = task.inspirationItems.find((i) => i.id === itemId);
  if (item) {
    item.status = "used";
    item.usedAt = new Date().toISOString();
    await resolveTaskSave(task);
  }
}
