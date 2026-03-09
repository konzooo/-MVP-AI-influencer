"use node";

/**
 * Server-side task runner — runs entirely within Convex, no Next.js dependency.
 * Called by the cron job every minute to execute due tasks.
 */

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

// ─── Types (inline to avoid importing from lib/) ──────────────────────────────

interface InspirationItem {
  id: string;
  type: "from_scratch" | "copy_post" | "own_image";
  status: "pending" | "used" | "skipped";
  notes: string;
  imageUrls?: string[];
  postType?: string;
  usedAt: string | null;
  preferredStyleMode?: string;
  preferredLocation?: string;
}

interface Task {
  _id: string;
  userId: string;
  externalId: string;
  name: string;
  status: string;
  approvalMode: string;
  cadence: { every: number; unit: string };
  scheduledTime: string | null;
  defaultPostType: string;
  defaultImageSize: string;
  fallbackLocations: { location: string; weight: number }[];
  fallbackNotes: string;
  inspirationItems: InspirationItem[];
  lastRunAt: string | null;
  nextRunAt: string | null;
}

// ─── Main: run all due tasks ──────────────────────────────────────────────────

export const runDueTasks = internalAction({
  args: {},
  handler: async (ctx) => {
    const dueTasks = await ctx.runQuery(internal.internalDb.getDueTasks);
    console.log(`[TaskRunner] ${dueTasks.length} due task(s)`);

    for (const task of dueTasks) {
      try {
        await runTaskById(ctx, task._id);
      } catch (err) {
        console.error(`[TaskRunner] Task ${task._id} failed:`, err);
      }
    }
  },
});

// ─── Run a single task (exported for manual triggering) ───────────────────────

export const executeTask = internalAction({
  args: { taskId: v.id("tasks") },
  handler: async (ctx, { taskId }) => {
    return await runTaskById(ctx, taskId);
  },
});

// ─── Private task execution logic ─────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function runTaskById(ctx: any, taskId: any): Promise<{ success: boolean; postId?: any; log: string[]; wasFallback?: boolean; warning?: string }> {
    const task = await ctx.runQuery(internal.internalDb.getTask, { id: taskId }) as Task | null;
    if (!task) throw new Error(`Task not found: ${taskId}`);

    const log: string[] = [];
    const addLog = (msg: string) => {
      log.push(msg);
      console.log(`[TaskRunner:${task.name}] ${msg}`);
    };

    addLog(`Starting task: "${task.name}"`);

    // ─── Step 1: Select inspiration item ───────────────────────────────────
    let selectedItem = task.inspirationItems.find((i) => i.status === "pending") || null;
    let wasFallback = false;

    if (!selectedItem) {
      addLog("Queue empty — synthesizing fallback item");
      selectedItem = synthesizeFromScratchItem(task);
      wasFallback = true;
    }

    addLog(`Selected item type: ${selectedItem.type}`);

    // ─── Step 2: Load settings (persona + AI preferences) ──────────────────
    const settings = await ctx.runQuery(internal.internalDb.getSettingsByUserId, {
      userId: task.userId as any,
    });
    const identity = settings?.identity || null;
    const aiSettings = settings?.aiSettings || {
      brainstormFromScratch: "claude",
      brainstormCopyPost: "gemini",
      carouselStyle: "quick_snaps",
    };

    const personaContext = identity?.isActive
      ? buildPersonaContext(identity)
      : undefined;

    // ─── Step 3: Brainstorm / Analyze ───────────────────────────────────────
    let postData: any;

    if (selectedItem.type === "own_image") {
      if (selectedItem.postType === "carousel") {
        addLog("Calling expand-carousel for own image...");
        postData = await expandOwnImageForCarousel({
          image: selectedItem.imageUrls?.[0] || "",
          notes: selectedItem.notes,
          personaContext,
          carouselStyle: aiSettings.carouselStyle,
        });
        // Prepend user image as slide 1 (userProvided)
        if (!postData.generatedImages) postData.generatedImages = [];
        postData.generatedImages.unshift({
          id: `user-${Date.now()}`,
          url: selectedItem.imageUrls?.[0] || "",
          prompt: "User provided image (carousel slide 1)",
          selected: true,
          createdAt: new Date().toISOString(),
          promptIndex: 0,
          userProvided: true,
          settings: { imageSize: task.defaultImageSize, numImages: 1, numVariations: 1, enableSafetyChecker: true },
        });
        postData.status = "approved";
        addLog(`Expand carousel complete: "${postData.title}"`);
      } else {
        addLog("Calling analyze-images for own image...");
        postData = await analyzeImages({
          images: selectedItem.imageUrls || [],
          notes: selectedItem.notes,
          personaContext,
        });
        // Add user images as generated (userProvided)
        postData.generatedImages = (selectedItem.imageUrls || []).map((url: string, idx: number) => ({
          id: `user-${Date.now()}-${idx}`,
          url,
          prompt: "User provided image",
          selected: true,
          createdAt: new Date().toISOString(),
          promptIndex: idx,
          userProvided: true,
          settings: { imageSize: task.defaultImageSize, numImages: 1, numVariations: 1, enableSafetyChecker: true },
        }));
        postData.status = "ready";
        addLog(`Analyze complete: "${postData.title}"`);
      }
    } else if (selectedItem.type === "copy_post") {
      addLog("Brainstorming in copy_post mode...");
      postData = await ctx.runAction((internal as any)["ai/brainstorm"].run, {
        idea: selectedItem.notes,
        images: selectedItem.imageUrls || [],
        creationMode: "copy_post",
        postType: selectedItem.postType || task.defaultPostType,
        personaContext,
        aiProvider: aiSettings.brainstormCopyPost || "gemini",
        carouselStyle: aiSettings.carouselStyle,
      });
      postData.status = "draft";
      addLog(`Brainstorm complete (copy_post): "${postData.title}"`);
    } else {
      // from_scratch
      const idea = buildFromScratchIdea(selectedItem, identity);
      addLog(`Brainstorming from_scratch (${aiSettings.brainstormFromScratch})...`);
      postData = await ctx.runAction((internal as any)["ai/brainstorm"].run, {
        idea,
        images: [],
        creationMode: "from_scratch",
        postType: selectedItem.postType || task.defaultPostType,
        personaContext,
        aiProvider: aiSettings.brainstormFromScratch || "claude",
        carouselStyle: aiSettings.carouselStyle,
      });
      postData.status = "draft";
      addLog(`Brainstorm complete (from_scratch): "${postData.title}"`);
    }

    // ─── Step 4: Create post record ─────────────────────────────────────────
    const now = new Date().toISOString();
    const postExternalId = `task-${task.externalId}-${Date.now()}`;

    const postId: any = await ctx.runMutation(internal.internalDb.insertPost, {
      userId: task.userId as any,
      externalId: postExternalId,
      status: postData.status || "draft",
      creationMode: selectedItem.type === "own_image" ? "from_own_images" : selectedItem.type,
      postType: selectedItem.postType || task.defaultPostType,
      title: postData.title || "",
      description: postData.description || "",
      caption: postData.caption || "",
      hashtags: postData.hashtags || [],
      notes: postData.notes || "",
      imagePrompts: (postData.imagePrompts || []).map((p: any) => ({
        prompt: p.prompt || "",
        negativePrompt: p.negativePrompt,
        referenceImages: p.referenceImages || [],
        referenceImageAnalysis: p.referenceImageAnalysis,
      })),
      referenceImages: [],
      generatedImages: postData.generatedImages || [],
      generationHistory: [],
      taskId: task.externalId,
      taskItemId: selectedItem.id,
      createdAt: now,
      updatedAt: now,
    });

    addLog(`Post created: ${postId}`);

    // ─── Step 5: Manual mode — stop here ───────────────────────────────────
    if (task.approvalMode === "manual") {
      addLog("Manual approval mode — stopping for review");
      await markItemUsed(ctx, task, selectedItem.id);
      await advanceTaskSchedule(ctx, task);
      return { success: true, postId, log, wasFallback };
    }

    // ─── Step 6: Automatic mode — generate images ───────────────────────────
    if (selectedItem.type === "own_image" && selectedItem.postType !== "carousel") {
      // No generation needed for own single images
      addLog("Own image — skipping generation");
    } else {
      addLog("Generating images...");

      // Fetch reference images from Convex storage (Phase 5 will populate these)
      const convexRefs = await ctx.runQuery(internal.internalDb.getReferenceImagesByUserId, {
        userId: task.userId as any,
      });

      let charRefUrl: string | null = null;
      if (convexRefs.length > 0) {
        // Use first reference image from Convex storage
        const ref = convexRefs[0];
        charRefUrl = await ctx.runQuery(internal.internalDb.getReferenceImageUrl, {
          storageId: ref.storageId,
        });
        addLog(`Using character reference from Convex storage: ${ref.filename}`);
      }

      if (!charRefUrl) {
        addLog("WARNING: No character reference available — skipping image generation. Add reference images in Phase 5.");
        await advanceTaskSchedule(ctx, task);
        return { success: true, postId, log, wasFallback, warning: "No character reference" };
      }

      // Generate images for each prompt
      const imagePrompts = postData.imagePrompts || [];
      const generatedImages: any[] = [...(postData.generatedImages || [])];
      let slide0GeneratedUrl: string | null = null;

      for (let promptIdx = 0; promptIdx < imagePrompts.length; promptIdx++) {
        // Skip userProvided slides
        const isUserProvided = generatedImages.some(
          (g) => g.promptIndex === promptIdx && g.userProvided
        );
        if (isUserProvided) {
          const userImg = generatedImages.find((g) => g.promptIndex === promptIdx && g.userProvided);
          if (userImg) slide0GeneratedUrl = userImg.url;
          addLog(`Skipping slide ${promptIdx + 1} (user provided)`);
          continue;
        }

        addLog(`Generating slide ${promptIdx + 1}/${imagePrompts.length}...`);

        // Carousel cascade: after slide 0, use its generated image as sole reference
        const isCarouselFollowSlide: boolean =
          (selectedItem.postType || task.defaultPostType) === "carousel" &&
          promptIdx > 0 &&
          slide0GeneratedUrl !== null;

        const referenceUrls: string[] = isCarouselFollowSlide
          ? [slide0GeneratedUrl!]
          : [charRefUrl];

        try {
          const genResult: { images: { url: string }[] } = await ctx.runAction((internal as any)["ai/generate"].run, {
            prompt: imagePrompts[promptIdx].prompt,
            imageUrls: referenceUrls,
            imageSize: task.defaultImageSize,
            numImages: 1,
            enableSafetyChecker: true,
          });

          if (genResult.images && genResult.images.length > 0) {
            const img: { url: string } = genResult.images[0];

            // Persist to Convex storage immediately (FAL URLs expire in 7 days)
            let permanentUrl = img.url;
            try {
              const stored = await ctx.runAction((internal as any)["imageStorage"].persistImageInternal, {
                url: img.url,
                mimeType: "image/jpeg",
              });
              permanentUrl = stored.permanentUrl;
              addLog(`Stored slide ${promptIdx + 1} permanently in Convex`);
            } catch (storeErr) {
              addLog(`WARNING: Could not persist slide ${promptIdx + 1} to storage — using temporary FAL URL`);
            }

            const newImage = {
              id: `gen-${Date.now()}-${promptIdx}`,
              url: permanentUrl,
              prompt: imagePrompts[promptIdx].prompt,
              selected: true,
              createdAt: new Date().toISOString(),
              promptIndex: promptIdx,
              settings: {
                imageSize: task.defaultImageSize,
                numImages: 1,
                numVariations: 1,
                enableSafetyChecker: true,
              },
            };
            generatedImages.unshift(newImage);

            if ((selectedItem.postType || task.defaultPostType) === "carousel" && promptIdx === 0) {
              slide0GeneratedUrl = permanentUrl;
              addLog("Slide 1 generated — will cascade as reference for remaining slides");
            }

            addLog(`Generated image for slide ${promptIdx + 1}`);
          }
        } catch (err) {
          addLog(`WARNING: Generation failed for slide ${promptIdx + 1}: ${err instanceof Error ? err.message : "unknown"}`);
        }
      }

      const generatedCount = generatedImages.filter((g) => !g.userProvided).length;
      const newStatus = generatedCount > 0 ? "ready" : "draft";

      await ctx.runMutation(internal.internalDb.updatePost, {
        id: postId,
        patch: { generatedImages, status: newStatus },
      });
      addLog(`Status: ${newStatus} (${generatedCount} images generated)`);
    }

    // ─── Step 7: Auto-publish ───────────────────────────────────────────────
    // Instagram publishing still goes via Next.js API (OAuth-based)
    // The task runner leaves the post at "ready" — the user publishes manually
    // or we can add a webhook callback in a future phase.
    addLog("Post ready — auto-publish not yet implemented in server-side runner");

    // ─── Step 8: Finalize ───────────────────────────────────────────────────
    await markItemUsed(ctx, task, selectedItem.id);
    await advanceTaskSchedule(ctx, task);

    addLog("Task run complete");
    return { success: true, postId, log, wasFallback };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function markItemUsed(ctx: any, task: Task, itemId: string) {
  const updatedItems = task.inspirationItems.map((item: InspirationItem) =>
    item.id === itemId
      ? { ...item, status: "used", usedAt: new Date().toISOString() }
      : item
  );
  await ctx.runMutation(internal.internalDb.updateTask, {
    id: task._id,
    patch: { inspirationItems: updatedItems },
  });
}

async function advanceTaskSchedule(ctx: any, task: Task) {
  const now = new Date().toISOString();
  const nextRunAt = computeNextRunAt(task);
  await ctx.runMutation(internal.internalDb.updateTask, {
    id: task._id,
    patch: { lastRunAt: now, nextRunAt },
  });
}

function computeNextRunAt(task: Task): string {
  const cadence = task.cadence;
  const multiplier = cadence.unit === "weeks" ? 7 : 1;
  const daysToAdd = cadence.every * multiplier;

  const next = new Date();
  next.setDate(next.getDate() + daysToAdd);

  if (task.scheduledTime) {
    const [hours, minutes] = task.scheduledTime.split(":").map(Number);
    next.setHours(hours, minutes, 0, 0);
  }

  return next.toISOString();
}

function synthesizeFromScratchItem(task: Task): InspirationItem {
  // Pick random fallback location
  let location: string | null = null;
  if (task.fallbackLocations && task.fallbackLocations.length > 0) {
    const total = task.fallbackLocations.reduce((s: number, l: { weight: number }) => s + l.weight, 0);
    let r = Math.random() * total;
    for (const loc of task.fallbackLocations) {
      r -= loc.weight;
      if (r <= 0) { location = loc.location; break; }
    }
    if (!location) location = task.fallbackLocations[task.fallbackLocations.length - 1].location;
  }

  const notes = task.fallbackNotes
    ? `${task.fallbackNotes}\n\nLocation: ${location || "Auto"}`
    : `Location: ${location || "Auto"}`;

  return {
    id: `fallback-${Date.now()}`,
    type: "from_scratch",
    status: "pending",
    notes,
    usedAt: null,
    postType: task.defaultPostType,
  };
}

function buildPersonaContext(identity: any): string {
  if (!identity) return "";
  const lines: string[] = [
    `You are creating content for an AI influencer named ${identity.name}.`,
  ];
  if (identity.backstory) lines.push(`Backstory: ${identity.backstory}`);
  if (identity.captionTone) lines.push(`Caption tone: ${identity.captionTone}`);
  if (identity.captionLanguage) lines.push(`Caption language: ${identity.captionLanguage}`);
  return lines.join("\n");
}

function buildFromScratchIdea(item: InspirationItem, identity: any): string {
  let idea = item.notes;
  if (item.preferredLocation) {
    idea += `\n\nLocation: ${item.preferredLocation}`;
  }
  return idea;
}

// ─── Own image helpers ────────────────────────────────────────────────────────

async function analyzeImages(params: {
  images: string[];
  notes: string;
  personaContext?: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { images, notes, personaContext } = params;
  const parts: object[] = [];

  let userMessage = `I have ${images.length} image${images.length > 1 ? "s" : ""} to post on Instagram. Please analyze and generate appropriate post details.`;
  if (notes.trim()) userMessage += `\n\nAdditional notes: ${notes}`;
  parts.push({ text: userMessage });

  for (const dataUri of images) {
    const match = dataUri.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
  }

  let systemPrompt = `Analyze the provided Instagram images and return a JSON post plan: {"title":"...","description":"...","caption":"...","hashtags":["..."],"imagePrompts":[{"prompt":"..."}],"notes":"..."}. The imagePrompts describe what's in the image. Return ONLY the JSON.`;
  if (personaContext) systemPrompt = `${personaContext}\n\n${systemPrompt}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts }],
        generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text);
}

async function expandOwnImageForCarousel(params: {
  image: string;
  notes: string;
  personaContext?: string;
  carouselStyle?: string;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const { image, notes, personaContext, carouselStyle } = params;
  const parts: object[] = [];

  let userMessage = `I have 1 image that I want to use as the first slide of an Instagram carousel (3 slides total). Please analyze it and generate 2 companion image prompts for slides 2-3 that create a cohesive set.`;
  if (notes.trim()) userMessage += `\n\nAdditional notes: ${notes}`;
  parts.push({ text: userMessage });

  const match = image.match(/^data:(.+?);base64,(.+)$/);
  if (match) {
    parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
  }

  const carouselInstruction = carouselStyle === "curated_series"
    ? "Each slide should be a distinct, carefully composed shot."
    : "Slides 2-3 should be quick pose/expression variations in the SAME scene.";

  let systemPrompt = `Analyze the provided carousel slide 1 image and return a JSON post plan for 3 slides: {"title":"...","description":"...","caption":"...","hashtags":["..."],"imagePrompts":[{"prompt":"slide 1 desc"},{"prompt":"slide 2 prompt"},{"prompt":"slide 3 prompt"}],"notes":"..."}. ${carouselInstruction} Return ONLY the JSON.`;
  if (personaContext) systemPrompt = `${personaContext}\n\n${systemPrompt}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ parts }],
        generationConfig: { temperature: 0.8, responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) throw new Error(`Gemini error: ${response.status}`);
  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text);
}
