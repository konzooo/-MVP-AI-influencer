"use client";

import {
  Task,
  InspirationItem,
  TaskRunResult,
  FromScratchInspirationItem,
} from "./task-types";
import {
  createEmptyPost,
  PostPlan,
  PostType,
} from "./types";
import { savePostToConvex as savePostState } from "./convex";
import { loadIdentity } from "./identity";
import { saveTaskToConvex as saveTask } from "./convex";
import { computeNextRunAt } from "./task-utils";
import {
  selectCharacterReference,
  buildContextFromStyleMode,
  buildContextFromKeywords,
} from "./reference-selector";
import { uploadToFalStorage } from "./fal";
import { checkDailyLimit, recordGeneration } from "./cost-tracker";
import { canPublish, recordPublish } from "./instagram-rate-limit";
import { ReferenceImage } from "./types";
import { loadAISettings } from "./ai-settings";

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
    /** Optional callback to persist a FAL URL to permanent storage. Returns the permanent URL. */
    persistImageUrl?: (url: string) => Promise<string>;
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

      charRefPaths = [{ id: charRef.id, path: charRef.imagePath }];

      // Persist selection on the post so it's stable for future runs
      post.selectedCharacterRefId = charRef.id;
      post.selectedCharacterRefPath = charRef.imagePath;
      post.characterRefs = charRefPaths;
      savePostState(post);

      log.add(`Selected character reference: ${charRef.id}`);
    }

    // Upload all character references to fal storage so they're publicly accessible
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const charRefUrls: string[] = [];

    for (const ref of charRefPaths) {
      log.add(`Uploading character reference ${ref.id} to fal storage...`);
      try {
        let refBase64: string;
        if (ref.path.startsWith("data:")) {
          // Already a base64 data URI (user-uploaded image)
          refBase64 = ref.path;
        } else {
          // Server path — fetch and convert to base64
          const localRefUrl = `${baseUrl}${ref.path}`;
          const refRes = await fetch(localRefUrl);
          if (!refRes.ok) throw new Error(`Failed to fetch reference image: ${refRes.status}`);
          const refBlob = await refRes.blob();
          const refBuffer = Buffer.from(await refBlob.arrayBuffer());
          refBase64 = `data:${refBlob.type || "image/jpeg"};base64,${refBuffer.toString("base64")}`;
        }
        const uploadedUrl = await uploadToFalStorage(refBase64, process.env.FAL_KEY!);
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

      // Skip userProvided prompt (own_image carousel slide 1)
      if (post.generatedImages.some((g) => g.promptIndex === promptIdx && g.userProvided)) {
        const userImg = post.generatedImages.find((g) => g.promptIndex === promptIdx && g.userProvided);
        if (userImg) slide0GeneratedUrl = userImg.url;
        log.add(`Skipping slide ${promptIdx + 1} (user provided)`);
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

      let referenceUrls: string[];
      if (isCarouselFollowSlide) {
        // Slide 1 generated image is the sole reference — it anchors identity, scene, outfit, and mood
        referenceUrls = [slide0GeneratedUrl!];
        log.add(`Slide ${promptIdx + 1}: using slide 1 image as reference (dropping character ref for consistency)`);
      } else {
        // Slide 1 or single image: all character references
        referenceUrls = [...charRefUrls];
      }

      // Add per-prompt references
      if (prompt.referenceImages && prompt.referenceImages.length > 0) {
        for (const ref of prompt.referenceImages) {
          if (ref.startsWith("data:")) {
            const uploadedUrl = await uploadToFalStorage(ref, process.env.FAL_KEY!);
            referenceUrls.push(uploadedUrl);
          } else {
            referenceUrls.push(ref);
          }
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
          const err = await generateRes.text();
          log.add(`WARNING: Generation failed for prompt ${promptIdx}: ${err}`);
          continue;
        }

        const genResult = await generateRes.json();
        if (!genResult.images || genResult.images.length === 0) {
          log.add(`WARNING: No images returned for prompt ${promptIdx}`);
          continue;
        }

        const img = genResult.images[0];

        // Persist to Convex storage (FAL URLs expire in 7 days)
        let permanentUrl = img.url;
        if (options.persistImageUrl) {
          try {
            permanentUrl = await options.persistImageUrl(img.url);
            log.add(`Stored slide ${promptIdx + 1} permanently`);
          } catch {
            log.add(`WARNING: Could not persist slide ${promptIdx + 1} — using temporary FAL URL`);
          }
        }

        post.generatedImages.unshift({
          id: `gen-${Date.now()}-${promptIdx}`,
          url: permanentUrl,
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
        });

        if (post.postType === "carousel" && promptIdx === 0) {
          slide0GeneratedUrl = permanentUrl;
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

    // Only mark as ready if at least one image was generated (excluding user-provided)
    const generatedCount = post.generatedImages.filter((g) => !g.userProvided).length;
    if (generatedCount === 0) {
      post.status = "draft";
      savePostState(post);
      result.error = "All image generations failed — no images produced";
      log.add(`ERROR: ${result.error}`);
      return result;
    }

    post.status = "ready";
    savePostState(post);
    log.add(`Status: ready (${generatedCount} images generated)`);

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
        selectedItem = synthesizeFromScratchItem(task);
        result.wasFallback = true;
      }
    }

    result.usedItem = selectedItem;
    log.add(`Selected item type: ${selectedItem.type}`);

    // ─── Step 3: Brainstorm / Analyze / Expand ────────────────────────────────

    let post: PostPlan;

    const identity = loadIdentity();
    const personaContext = identity.isActive
      ? (await import("./identity")).buildPersonaContext(identity)
      : undefined;

    if (selectedItem.type === "own_image") {
      if (selectedItem.postType === "carousel") {
        // POST /api/expand-carousel
        log.add(`Calling expand-carousel API for user image...`);
        const expandRes = await fetch("/api/expand-carousel", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: selectedItem.imageUrls[0],
            notes: selectedItem.notes,
            personaContext,
            carouselStyle: loadAISettings().carouselStyle,
          }),
        });

        if (!expandRes.ok) {
          const err = await expandRes.text();
          result.error = `Expand carousel failed: ${err}`;
          log.add(`ERROR: ${result.error}`);
          return result;
        }

        const expandPlan = await expandRes.json();
        post = createEmptyPost("from_own_images", "carousel");
        Object.assign(post, expandPlan);
        post.status = "approved"; // needs generation for slides 2-3

        // No need to inject per-prompt references here — the generation loop
        // automatically uses slide 1's image (userProvided) as the sole reference
        // for companion slides via slide0GeneratedUrl cascading.

        log.add(
          `Expand carousel complete: "${post.title}" with ${post.imagePrompts.length} prompts`
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
        log.add(`Calling analyze-images API for user image...`);
        const analyzeRes = await fetch("/api/analyze-images", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            images: selectedItem.imageUrls,
            notes: selectedItem.notes,
            personaContext,
          }),
        });

        if (!analyzeRes.ok) {
          const err = await analyzeRes.text();
          result.error = `Analyze images failed: ${err}`;
          log.add(`ERROR: ${result.error}`);
          return result;
        }

        const analyzePlan = await analyzeRes.json();
        post = createEmptyPost("from_own_images", selectedItem.postType);
        Object.assign(post, analyzePlan);
        post.status = "ready"; // skips generation — own images are final
        log.add(`Analyze complete: "${post.title}"`);

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
      log.add(`Calling brainstorm API in copy_post mode...`);
      const brainstormRes = await fetch("/api/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea: selectedItem.notes,
          images: selectedItem.imageUrls,
          creationMode: "copy_post",
          postType: selectedItem.postType,
          personaContext,
        }),
      });

      if (!brainstormRes.ok) {
        const err = await brainstormRes.text();
        result.error = `Brainstorm failed: ${err}`;
        log.add(`ERROR: ${result.error}`);
        return result;
      }

      const brainstormPlan = await brainstormRes.json();
      post = createEmptyPost("copy_post", selectedItem.postType);
      Object.assign(post, brainstormPlan);
      post.status = "draft";
      log.add(
        `Brainstorm complete (copy_post): "${post.title}" with ${post.imagePrompts.length} prompts`
      );
    } else {
      // from_scratch
      // POST /api/brainstorm (from_scratch mode)
      const idea = buildFromScratchIdea(
        selectedItem as FromScratchInspirationItem,
        identity
      );
      const aiSettings = loadAISettings();
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
        const err = await brainstormRes.text();
        result.error = `Brainstorm failed: ${err}`;
        log.add(`ERROR: ${result.error}`);
        return result;
      }

      const brainstormPlan = await brainstormRes.json();
      post = createEmptyPost("from_scratch", selectedItem.postType);
      Object.assign(post, brainstormPlan);
      post.status = "draft";
      log.add(
        `Brainstorm complete (from_scratch): "${post.title}" with ${post.imagePrompts.length} prompts`
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
              post.selectedCharacterRefPath = charRef.imagePath;
              post.characterRefs = [{ id: charRef.id, path: charRef.imagePath }];
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
      markItemUsed(task, selectedItem.id);

      // Always advance nextRunAt so the scheduler doesn't re-fire every 60s
      task.lastRunAt = new Date().toISOString();
      task.nextRunAt = computeNextRunAt(task);
      saveTask(task);
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
    markItemUsed(task, selectedItem.id);

    // Update task timestamps
    task.lastRunAt = new Date().toISOString();
    task.nextRunAt = computeNextRunAt(task);
    saveTask(task);

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

function synthesizeFromScratchItem(task: Task): FromScratchInspirationItem {
  const identity = loadIdentity();

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

function markItemUsed(task: Task, itemId: string): void {
  const item = task.inspirationItems.find((i) => i.id === itemId);
  if (item) {
    item.status = "used";
    item.usedAt = new Date().toISOString();
    saveTask(task);
  }
}
