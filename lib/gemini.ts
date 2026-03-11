import { CreationMode, PostType } from "./types";
import { DEFAULT_TRANSPARENCY, resolveCarouselStyle } from "./transparency";
import type { CarouselStyle } from "./ai-settings";
import { extractGeminiErrorMessage } from "./llm-errors";

// ─── System Prompts — single source of truth is lib/transparency.ts ──────────
// Edit prompts there; this file imports them so the transparency page always
// reflects exactly what's running.

const { fromScratchPrompt: FROM_SCRATCH_PROMPT, copyPostPrompt: COPY_POST_PROMPT } =
  DEFAULT_TRANSPARENCY.geminiPrompts;

// ─── Prompt selector ─────────────────────────────────────────────────────────

function getSystemPrompt(mode: CreationMode, carouselStyle: CarouselStyle = "quick_snaps"): string {
  const raw = mode === "copy_post" ? COPY_POST_PROMPT : FROM_SCRATCH_PROMPT;
  return resolveCarouselStyle(raw, carouselStyle);
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BrainstormRequest {
  idea: string;
  images: string[]; // base64 data URIs
  creationMode: CreationMode;
  postType: PostType;
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

// ─── Shared Gemini request with timeout and rate-limit handling ──────────────

async function geminiRequest(
  systemPrompt: string,
  parts: GeminiPart[],
  apiKey: string,
  temperature = 0.8,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts }],
          generationConfig: { temperature, responseMimeType: "application/json" },
        }),
        signal: controller.signal,
      }
    );
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Gemini API timed out after 2 minutes — try again or check your API quota");
    }
    throw err;
  }
  clearTimeout(timeout);

  if (!response.ok) {
    const errorMessage = await extractGeminiErrorMessage(response);
    console.error("[Gemini] API error:", { status: response.status, error: errorMessage.slice(0, 300) });
    throw new Error(errorMessage);
  }

  return response;
}

// ─── API Call ────────────────────────────────────────────────────────────────

export async function brainstormWithGemini(
  req: BrainstormRequest,
  apiKey: string,
  personaContext?: string,
  carouselStyle?: CarouselStyle
) {
  const parts: GeminiPart[] = [];

  // Build context-aware user message
  const contextParts: string[] = [];
  contextParts.push(`Post type: ${req.postType}`);
  contextParts.push(`Creation mode: ${req.creationMode}`);

  if (req.idea) {
    contextParts.push(`\nUser notes:\n${req.idea}`);
  }

  if (req.images.length > 0 && req.creationMode === "copy_post") {
    contextParts.push(
      `\n${req.images.length} reference image(s) attached. Analyze each one and create a recreation plan.`
    );
  } else if (req.images.length > 0) {
    contextParts.push(
      `\n${req.images.length} inspiration image(s) attached for reference.`
    );
  }

  parts.push({ text: contextParts.join("\n") });

  // Add images
  for (const dataUri of req.images) {
    const match = dataUri.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    }
  }

  if (parts.length === 0) {
    throw new Error("Please provide an idea or upload an image");
  }

  let systemPrompt = getSystemPrompt(req.creationMode, carouselStyle);
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  console.log("[Gemini] brainstorm: calling API...");
  const response = await geminiRequest(systemPrompt, parts, apiKey);

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("[Gemini] No text in response:", JSON.stringify(data).slice(0, 500));
    throw new Error("No response from Gemini");
  }

  // Parse the JSON response
  const plan = JSON.parse(text);
  return plan;
}

// ─── Image Analysis for Own Images ──────────────────────────────────────────

const ANALYZE_OWN_IMAGES_PROMPT = DEFAULT_TRANSPARENCY.geminiPrompts.analyzeOwnImagesPrompt;

export async function analyzeImagesWithGemini(
  images: string[], // base64 data URIs
  notes: string, // optional user notes about caption style, context, etc.
  apiKey: string,
  personaContext?: string
) {
  const parts: GeminiPart[] = [];

  let userMessage = `I have ${images.length} image${images.length > 1 ? "s" : ""} to post on Instagram. Please analyze and generate appropriate post details.`;

  if (notes.trim()) {
    userMessage += `\n\nAdditional notes: ${notes}`;
  }

  parts.push({ text: userMessage });

  // Add images
  for (const dataUri of images) {
    const match = dataUri.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      parts.push({
        inlineData: {
          mimeType: match[1],
          data: match[2],
        },
      });
    }
  }

  let systemPrompt = ANALYZE_OWN_IMAGES_PROMPT;
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  console.log("[Gemini] analyzeOwnImages: calling API...");
  const response = await geminiRequest(systemPrompt, parts, apiKey, 0.7);

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    console.error("[Gemini] No text in response:", JSON.stringify(data).slice(0, 500));
    throw new Error("No response from Gemini");
  }

  const result = JSON.parse(text);
  return result;
}

// ─── Expand Own Image into Carousel ─────────────────────────────────────────

const EXPAND_OWN_IMAGE_CAROUSEL_PROMPT = DEFAULT_TRANSPARENCY.geminiPrompts.expandCarouselPrompt;

export async function expandOwnImageForCarousel(
  image: string, // base64 data URI of the user's image
  notes: string,
  apiKey: string,
  personaContext?: string,
  carouselStyle?: CarouselStyle
) {
  const parts: GeminiPart[] = [];

  let userMessage = `I have 1 image that I want to use as the first slide of an Instagram carousel (3 slides total). Please analyze it and generate 2 companion image prompts for slides 2-3 that create a cohesive set.`;

  if (notes.trim()) {
    userMessage += `\n\nAdditional notes: ${notes}`;
  }

  parts.push({ text: userMessage });

  // Add image
  const match = image.match(/^data:(.+?);base64,(.+)$/);
  if (match) {
    parts.push({
      inlineData: {
        mimeType: match[1],
        data: match[2],
      },
    });
    console.log("[Gemini] expandOwnImageForCarousel: image attached, mimeType:", match[1], "size:", Math.round(match[2].length / 1024), "KB");
  } else {
    console.error("[Gemini] expandOwnImageForCarousel: image is not a valid base64 data URI, starts with:", image.slice(0, 50));
    throw new Error("Invalid image format — expected base64 data URI");
  }

  let systemPrompt = resolveCarouselStyle(EXPAND_OWN_IMAGE_CAROUSEL_PROMPT, carouselStyle || "quick_snaps");
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  console.log("[Gemini] expandOwnImageForCarousel: calling API...");
  const response = await geminiRequest(systemPrompt, parts, apiKey);

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    const blockReason = data.candidates?.[0]?.finishReason;
    const promptFeedback = data.promptFeedback?.blockReason;
    console.error("[Gemini] No text in response:", JSON.stringify(data).slice(0, 500));
    if (promptFeedback) {
      throw new Error(`Gemini blocked the request: ${promptFeedback}`);
    }
    if (blockReason && blockReason !== "STOP") {
      throw new Error(`Gemini stopped early: ${blockReason}`);
    }
    throw new Error("No response from Gemini — the model returned empty content");
  }

  const result = JSON.parse(text);
  return result;
}
