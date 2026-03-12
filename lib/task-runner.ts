import {
  Task,
  InspirationItem,
  TaskRunResult,
  FromScratchInspirationItem,
} from "./task-types";
import {
  createEmptyPost,
  PostPlan,
} from "./types";
import { savePost as savePostState } from "./store";
import { loadIdentity } from "./identity";
import { loadIdentityAsync } from "./identity";
import { saveTask, saveTaskAsync, computeNextRunAt } from "./task-store";
import {
  selectCharacterReference,
  buildContextFromStyleMode,
  buildContextFromKeywords,
} from "./reference-selector";
import { checkDailyLimit, getLLMUsageFromHeaders, recordGeneration, recordLLMCall } from "./cost-tracker";
import { canPublish, recordPublish } from "./instagram-rate-limit";
import { ReferenceImage } from "./types";
import { loadAISettings } from "./ai-settings";
import { loadAISettingsAsync } from "./ai-settings";
import { saveGeneratedImagesToLibrary } from "./generated-image-library";

const isServer = typeof window === "undefined";

/** Load identity from Convex (server) or localStorage (client) */
async function resolveIdentity() {
  return isServer ? loadIdentityAsync() : loadIdentity();
}

/** Load AI settings from Convex (server) or localStorage (client) */
async function resolveAISettings() {
  return isServer ? loadAISettingsAsync() : loadAISettings();
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

async function uploadImageSource(source: string): Promise<string> {
  const response = await fetch("/api/upload", {
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

  try {
    post.status = "generating";
    savePostState(post);

    // Resolve character references — use stored refs if available, otherwise select fresh
    // Supports new multi-ref format (characterRefs[]) and legacy single ref
    let charRefPaths: { id: string; path: string }[] = [];

    if (post.characterRefs && post.characterRefs.length > 0) {
      charRefPaths = post.characterRefs;
      log.add(`Using ${charRefPaths.length} stored character reference(s): ${charRefPaths.map(r => r.id).join(", ")}`);
    } else if (post.selectedCharacterRefId && post.selectedCharacterRefPath) {
      // Legacy single ref
      charRefPaths = [{ id: post.selectedCharacterRefId, path: post.selectedCharacterRefPath }];
      log.add(`Using stored character reference (legacy): ${post.selectedCharacterRefId}`);
    } else {
      log.add(`No stored ref — fetching reference library...`);
      const refsRes = await fetch("/api/reference-images");
      if (!refsRes.ok) {
        result.error = "Could not fetch reference library";
        log.add(`ERROR: ${result.error}`);
        return result;
      }

      const refsData = await refsRes.json();
      const refs: ReferenceImage[] = refsData.images || [];
      if (refs.length === 0) {
        result.error = "No character references in library";
        log.add(`ERROR: ${result.error}`);
        return result;
      }

      let refContext = buildContextFromStyleMode(post.title);
      if (options.styleModeHint) {
        refContext = buildContextFromStyleMode(options.styleModeHint);
      }

      const charRef = selectCharacterReference(refs, refContext);
      if (!charRef) {
        result.error = "Failed to select character reference";
        log.add(`ERROR: ${result.error}`);
        return result;
      }

      charRefPaths = [{ id: charRef.id, path: charRef.referencePath }];

      // Persist selection on the post so it's stable for future runs
      post.selectedCharacterRefId = charRef.id;
      post.selectedCharacterRefPath = charRef.referencePath;
      post.characterRefs = charRefPaths;
      savePostState(post);

      log.add(`Selected character reference: ${charRef.id}`);
    }

    // Upload all character references to fal storage so they're publicly accessible
    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ||
      (typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000");
    const charRefUrls: string[] = [];

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
        result.error = `Failed to upload character reference ${ref.id}: ${err instanceof Error ? err.message : "Unknown error"}`;
        log.add(`ERROR: ${result.error}`);
        return result;
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
        savePostState(post);
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
      const limit = checkDailyLimit();
      if (!limit.allowed) {
        result.error = `Daily generation limit exceeded (${limit.dailySpend}€ / ${limit.dailyStopLimit}€)`;
        log.add(`ERROR: ${result.error}`);
        savePostState(post);
        return result;
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
      if (isOwnImageCarouselFollowSlide && charRefUrls.length > 0) {
        // Ad-hoc own-image carousels use the editable reference set, prefilled with slide 1.
        referenceUrls = [...charRefUrls];
        log.add(
          `Slide ${promptIdx + 1}: using ${charRefUrls.length} editable reference image(s)`
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
        const generateRes = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: prompt.prompt,
            imageUrls: referenceUrls,
            imageSize: options.imageSize,
            numImages: 1,
            maxImages: 1,
          }),
          signal: options.signal,
        });

        if (!generateRes.ok) {
          const err = await readApiError(generateRes);
          log.add(`WARNING: Generation failed for prompt ${promptIdx}: ${err}`);
          continue;
        }

        const genResult = await generateRes.json();
        if (!genResult.images || genResult.images.length === 0) {
          log.add(`WARNING: No images returned for prompt ${promptIdx}`);
          continue;
        }

        const img = genResult.images[0];
        const generatedImage = {
          id: `gen-${Date.now()}-${promptIdx}`,
          url: img.url,
          prompt: prompt.prompt,
          seed: img.seed,
          selected: true,
          createdAt: new Date().toISOString(),
          promptIndex: promptIdx,
          settings: {
            imageSize: options.imageSize,
            numImages: 1,
            numVariations: 1,
            enableSafetyChecker: true,
          },
        };

        post.generatedImages.unshift(generatedImage);
        saveGeneratedImagesToLibrary([generatedImage], {
          postId: post.id,
          postTitle: post.title,
        });

        if (post.postType === "carousel" && promptIdx === 0) {
          slide0GeneratedUrl = img.url;
          log.add(`Slide 1 generated — will cascade as reference for remaining slides`);
        }

        log.add(`Generated image for prompt ${promptIdx + 1}`);
        recordGeneration();

        // Save after each image so the UI can poll progress
        savePostState(post);
      } catch (err) {
        // If aborted, stop immediately and reset to draft
        if (err instanceof DOMException && err.name === "AbortError") {
          result.error = "Generation stopped by user";
          log.add("Generation stopped by user");
          post.status = "draft";
          savePostState(post);
          return result;
        }
        log.add(
          `ERROR generating prompt ${promptIdx}: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    const filledPromptCount = post.imagePrompts.reduce((count, _, promptIdx) => {
      return count + (getFilledImageForPrompt(post, promptIdx) ? 1 : 0);
    }, 0);
    const generatedCount = post.generatedImages.filter((g) => !g.userProvided).length;

    if (filledPromptCount < post.imagePrompts.length) {
      post.status = "draft";
      savePostState(post);
      result.error = `Some slides are still missing images (${filledPromptCount}/${post.imagePrompts.length} filled)`;
      log.add(`ERROR: ${result.error}`);
      return result;
    }

    post.status = "ready";
    savePostState(post);
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
      savePostState(post);
      return result;
    }
    const msg = err instanceof Error ? err.message : "Unknown error";
    result.error = msg;
    log.add(`EXCEPTION: ${msg}`);
    return result;
  }
}

/**
 * Main task execution engine
 *
 * Orchestrates the full pipeline from inspiration item selection through posting
 */
export async function runTask(
  task: Task,
  options?: { overrideItemId?: string }
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

  try {
    log.add(`Starting task: "${task.name}"`);

    // ─── Step 1: Select inspiration item ───────────────────────────────────────

    let selectedItem: InspirationItem | null = null;

    // If override specified, use that item
    if (options?.overrideItemId) {
      selectedItem =
        task.inspirationItems.find((i) => i.id === options.overrideItemId) || null;
      if (!selectedItem) {
        result.error = `Item not found: ${options.overrideItemId}`;
        return result;
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
        const expandRes = await fetch("/api/expand-carousel", {
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
          result.error = `Expand carousel failed: ${err}`;
          log.add(`ERROR: ${result.error}`);
          return result;
        }

        const providerUsed = (expandRes.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? aiSettings.expandCarousel;
        const expandPlan = await expandRes.json();
        const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(expandRes.headers) : undefined;
        recordLLMCall(providerUsed, "expand_carousel", usage?.cost ?? 0, usage);
        post = createEmptyPost("from_own_images", "carousel");
        Object.assign(post, expandPlan);
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
        const analyzeRes = await fetch("/api/analyze-images", {
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
          result.error = `Analyze images failed: ${err}`;
          log.add(`ERROR: ${result.error}`);
          return result;
        }

        const providerUsed = (analyzeRes.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? aiSettings.analyzeImages;
        const analyzePlan = await analyzeRes.json();
        const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(analyzeRes.headers) : undefined;
        recordLLMCall(providerUsed, "analyze_images", usage?.cost ?? 0, usage);
        post = createEmptyPost("from_own_images", selectedItem.postType);
        Object.assign(post, analyzePlan);
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
      const brainstormRes = await fetch("/api/brainstorm", {
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
        result.error = `Brainstorm failed: ${err}`;
        log.add(`ERROR: ${result.error}`);
        return result;
      }

      const providerUsed = (brainstormRes.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? aiSettings.brainstormCopyPost;
      const brainstormPlan = await brainstormRes.json();
      const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(brainstormRes.headers) : undefined;
      recordLLMCall(providerUsed, "brainstorm", usage?.cost ?? 0, usage);
      post = createEmptyPost("copy_post", selectedItem.postType);
      Object.assign(post, brainstormPlan);
      post.status = "draft";
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
      const brainstormRes = await fetch("/api/brainstorm", {
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
        result.error = `Brainstorm failed: ${err}`;
        log.add(`ERROR: ${result.error}`);
        return result;
      }

      const providerUsed = (brainstormRes.headers.get("x-ai-provider") as "gemini" | "claude" | null) ?? aiSettings.brainstormFromScratch;
      const brainstormPlan = await brainstormRes.json();
      const usage = providerUsed === "claude" ? getLLMUsageFromHeaders(brainstormRes.headers) : undefined;
      recordLLMCall(providerUsed, "brainstorm", usage?.cost ?? 0, usage);
      post = createEmptyPost("from_scratch", selectedItem.postType);
      Object.assign(post, brainstormPlan);
      post.status = "draft";
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
        const refsRes = await fetch("/api/reference-images");
        if (refsRes.ok) {
          const refsData = await refsRes.json();
          const refs: ReferenceImage[] = refsData.images || [];
          if (refs.length > 0) {
            let refContext;
            if (selectedItem.type === "from_scratch") {
              const item = selectedItem as FromScratchInspirationItem;
              refContext = item.preferredStyleMode
                ? buildContextFromStyleMode(item.preferredStyleMode)
                : buildContextFromKeywords([post.title, post.description].filter(Boolean).join(" "));
            } else {
              refContext = buildContextFromKeywords([post.title, post.description, post.caption].filter(Boolean).join(" "));
            }
            const charRef = selectCharacterReference(refs, refContext);
            if (charRef) {
              post.selectedCharacterRefId = charRef.id;
              post.selectedCharacterRefPath = charRef.referencePath;
              post.characterRefs = [{ id: charRef.id, path: charRef.referencePath }];
              log.add(`Character reference selected: ${charRef.id}`);
            }
          }
        }
      } catch (err) {
        log.add(`WARNING: Could not pre-select character reference: ${err instanceof Error ? err.message : "unknown"}`);
      }
    }

    // ─── Step 5: Manual mode — stop here ──────────────────────────────────────

    if (task.approvalMode === "manual") {
      log.add(`Manual approval mode: saving post at ${post.status}, stopping`);
      savePostState(post);
      await markItemUsed(task, selectedItem.id);

      // Always advance nextRunAt so the scheduler doesn't re-fire every 60s
      task.lastRunAt = new Date().toISOString();
      task.nextRunAt = computeNextRunAt(task);
      await resolveTaskSave(task);
      log.add(`Next run scheduled: ${task.nextRunAt}`);

      result.success = true;
      result.postId = post.id;
      return result;
    }

    // ─── Step 6: Automatic mode — full pipeline ───────────────────────────────

    log.add(`Automatic mode: advancing through pipeline...`);

    // Advance to approved
    post.status = "approved";
    log.add(`Status: approved`);

    // If no generation needed (own_image single/story), skip to publish
    if (selectedItem.type === "own_image" && selectedItem.postType !== "carousel") {
      post.status = "ready";
      savePostState(post);
      log.add(`Status: ready (own image, no generation needed)`);
    } else {
      // Determine style mode hint for character reference selection
      let styleModeHint: string | undefined;
      if (selectedItem.type === "from_scratch") {
        const item = selectedItem as FromScratchInspirationItem;
        if (item.preferredStyleMode) {
          styleModeHint = item.preferredStyleMode;
        }
      }

      const genResult = await generatePostImages(post, {
        imageSize: task.defaultImageSize,
        styleModeHint,
      });

      for (const line of genResult.log) {
        log.add(line);
      }

      if (!genResult.success) {
        result.error = genResult.error;
        return result;
      }
    }

    log.add(`Post saved: ${post.id}`);

    // ─── Step 7: Auto-publish ─────────────────────────────────────────────────

    log.add(`Attempting to publish to Instagram...`);

    // Check Instagram connection
    const accountRes = await fetch("/api/instagram/account");
    const account = await accountRes.json();

    if (!account.connected) {
      log.add(`WARNING: Instagram not connected, leaving post at ready`);
    } else if (!canPublish()) {
      log.add(`WARNING: Daily Instagram post limit reached`);
    } else {
      try {
        const publishRes = await fetch("/api/instagram/publish", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageUrls: post.generatedImages
              .filter((g) => g.selected)
              .map((g) => g.url),
            caption: post.caption,
            hashtags: post.hashtags,
            postType: post.postType,
          }),
        });

        if (!publishRes.ok) {
          const err = await publishRes.json();
          log.add(`WARNING: Publish failed: ${err.error}`);
        } else {
          const result = await publishRes.json();
          post.status = "posted";
          post.publishingInfo = {
            status: "published",
            igPostId: result.igPostId,
            permalink: result.permalink,
            publishedAt: new Date().toISOString(),
          };
          recordPublish();
          log.add(`Status: posted`);
          log.add(`Instagram: ${result.permalink}`);
        }
      } catch (err) {
        log.add(
          `ERROR during publish: ${err instanceof Error ? err.message : "Unknown error"}`
        );
      }
    }

    // ─── Step 8: Finalize ─────────────────────────────────────────────────────

    savePostState(post);
    await markItemUsed(task, selectedItem.id);

    // Update task timestamps
    task.lastRunAt = new Date().toISOString();
    task.nextRunAt = computeNextRunAt(task);
    await resolveTaskSave(task);

    log.add(`Task run complete`);
    result.success = true;
    result.postId = post.id;
    return result;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    result.error = msg;
    log.add(`EXCEPTION: ${msg}`);
    return result;
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
