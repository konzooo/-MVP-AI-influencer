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
import { loadPosts, savePost as savePostState } from "./store";
import { loadIdentity } from "./identity";
import { saveTask, computeNextRunAt } from "./task-store";
import {
  selectCharacterReference,
  buildContextFromStyleMode,
  buildContextFromKeywords,
} from "./reference-selector";
import { uploadToFalStorage } from "./fal";
import { checkDailyLimit, recordGeneration } from "./cost-tracker";
import { canPublish, recordPublish } from "./instagram-rate-limit";
import { ReferenceImage } from "./types";

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

    // ─── Step 1: Guard against in-flight posts ─────────────────────────────────

    const existingPosts = loadPosts();
    const inFlightPosts = existingPosts.filter(
      (p) => p.taskId === task.id && !["posted", "scheduled"].includes(p.status)
    );

    if (inFlightPosts.length > 0) {
      result.error = `Previous run not yet complete: ${inFlightPosts[0].title || inFlightPosts[0].id}`;
      log.add(`ABORT: ${result.error}`);
      return result;
    }

    // ─── Step 2: Select inspiration item ───────────────────────────────────────

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
        // Queue empty — synthesize from_scratch item from identity context
        log.add(`Queue empty, synthesizing from_scratch fallback item`);
        const identity = loadIdentity();
        selectedItem = synthesizeFromScratchItem(
          task.defaultPostType,
          identity.styleModes,
          identity.preferredLocations
        );
        result.wasFallback = true;
      }
    }

    result.usedItem = selectedItem;
    log.add(`Selected item type: ${selectedItem.type}`);

    // ─── Step 3: Brainstorm / Analyze / Expand ────────────────────────────────

    let post: PostPlan;
    const geminiApiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    if (!geminiApiKey) {
      result.error = "GEMINI_API_KEY not configured";
      return result;
    }

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
        post.status = "approved"; // needs generation for slides 2-4
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
      log.add(`Calling brainstorm API in from_scratch mode...`);
      const brainstormRes = await fetch("/api/brainstorm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idea,
          images: [],
          creationMode: "from_scratch",
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
      post = createEmptyPost("from_scratch", selectedItem.postType);
      Object.assign(post, brainstormPlan);
      post.status = "draft";
      log.add(
        `Brainstorm complete (from_scratch): "${post.title}" with ${post.imagePrompts.length} prompts`
      );
    }

    // ─── Step 4: Attach task metadata ──────────────────────────────────────────

    post.taskId = task.id;
    post.taskItemId = selectedItem.id;

    // ─── Step 5: Manual mode — stop here ──────────────────────────────────────

    if (task.approvalMode === "manual") {
      log.add(`Manual approval mode: saving post at ${post.status}, stopping`);
      savePostState(post);
      markItemUsed(task, selectedItem.id);
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
      log.add(`Status: ready (own image, no generation needed)`);
    } else {
      // Generation needed: fetch reference library, select character ref, generate
      log.add(`Fetching reference library for character reference...`);
      const refsRes = await fetch("/api/reference-images");
      if (!refsRes.ok) {
        log.add(`WARNING: Could not fetch reference library`);
      } else {
        const refs: ReferenceImage[] = await refsRes.json();
        if (refs.length === 0) {
          result.error = "No character references in library";
          log.add(`ERROR: ${result.error}`);
          savePostState(post);
          return result;
        }

        // Select character reference based on post context
        let refContext = buildContextFromStyleMode(post.title);
        if (selectedItem.type === "from_scratch") {
          const item = selectedItem as FromScratchInspirationItem;
          if (item.preferredStyleMode) {
            refContext = buildContextFromStyleMode(item.preferredStyleMode);
          }
        }

        const charRef = selectCharacterReference(refs, refContext);
        if (!charRef) {
          result.error = "Failed to select character reference";
          log.add(`ERROR: ${result.error}`);
          return result;
        }

        log.add(`Selected character reference: ${charRef.id}`);

        // Upload character reference to CDN
        const baseUrl =
          process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
        const charRefUrl = `${baseUrl}${charRef.imagePath}`;

        // Generation for each prompt
        post.status = "generating";
        for (let promptIdx = 0; promptIdx < post.imagePrompts.length; promptIdx++) {
          const prompt = post.imagePrompts[promptIdx];

          // Skip userProvided prompt (carousel slide 1)
          if (post.generatedImages.some((g) => g.promptIndex === promptIdx && g.userProvided)) {
            log.add(`Skipping slide ${promptIdx + 1} (user provided)`);
            continue;
          }

          log.add(`Generating images for prompt ${promptIdx + 1}/${post.imagePrompts.length}...`);

          // Check cost limit before generation
          const limit = checkDailyLimit();
          if (!limit.allowed) {
            result.error = `Daily generation limit exceeded (${limit.dailySpend}€ / ${limit.dailyStopLimit}€)`;
            log.add(`ERROR: ${result.error}`);
            post.status = "generating"; // leave partial
            savePostState(post);
            return result;
          }

          // Prepare reference URLs for this prompt
          const referenceUrls: string[] = [charRefUrl];

          // Add existing references from the prompt
          if (prompt.referenceImages && prompt.referenceImages.length > 0) {
            // Try to upload to CDN if they're base64, otherwise assume they're URLs
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
                imageSize: task.defaultImageSize,
                numImages: 1,
                maxImages: 1,
              }),
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

            // Auto-select first image
            const img = genResult.images[0];
            post.generatedImages.unshift({
              id: `gen-${Date.now()}-${promptIdx}`,
              url: img.url,
              prompt: prompt.prompt,
              seed: img.seed,
              selected: true,
              createdAt: new Date().toISOString(),
              promptIndex: promptIdx,
              settings: {
                imageSize: task.defaultImageSize,
                numImages: 1,
                numVariations: 1,
                enableSafetyChecker: true,
              },
            });

            log.add(`Generated image for prompt ${promptIdx + 1}`);
            recordGeneration();
          } catch (err) {
            log.add(
              `ERROR generating prompt ${promptIdx}: ${err instanceof Error ? err.message : "Unknown error"}`
            );
          }
        }

        post.status = "ready";
        log.add(`Status: ready`);
      }
    }

    savePostState(post);
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

function synthesizeFromScratchItem(
  postType: PostType,
  styleModes: Array<{ name: string }>,
  locations: string[]
): FromScratchInspirationItem {
  const styleMode =
    styleModes[Math.floor(Math.random() * styleModes.length)]?.name || null;
  const location = locations[Math.floor(Math.random() * locations.length)] || null;

  return {
    id: `fallback-${Date.now()}`,
    type: "from_scratch",
    status: "pending",
    notes: `Fallback: ${styleMode || "Auto"} at ${location || "Auto location"}`,
    usedAt: null,
    preferredStyleMode: styleMode,
    preferredLocation: location,
    postType,
  };
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
