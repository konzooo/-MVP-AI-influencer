import { CreationMode, PostType } from "./types";
import { DEFAULT_TRANSPARENCY, resolveCarouselStyle } from "./transparency";
import type { CarouselStyle } from "./ai-settings";
import { extractClaudeErrorMessage } from "./llm-errors";

const {
  fromScratchPrompt: FROM_SCRATCH_PROMPT,
  copyPostPrompt: COPY_POST_PROMPT,
  analyzeOwnImagesPrompt: ANALYZE_OWN_IMAGES_PROMPT,
  expandCarouselPrompt: EXPAND_CAROUSEL_PROMPT,
  promptHelperPrompt: PROMPT_HELPER_PROMPT,
  captionHelperPrompt: CAPTION_HELPER_PROMPT,
} = DEFAULT_TRANSPARENCY.geminiPrompts;

interface ClaudeTextBlock {
  type: "text";
  text: string;
}

interface ClaudeImageBlock {
  type: "image";
  source: {
    type: "base64";
    media_type: string;
    data: string;
  };
}

type ClaudeContentBlock = ClaudeTextBlock | ClaudeImageBlock;

interface ClaudeRequestOptions {
  systemPrompt: string;
  userMessage: string;
  images?: string[];
  maxTokens?: number;
  temperature?: number;
}

interface ClaudeBrainstormRequest {
  idea: string;
  images: string[];
  creationMode: CreationMode;
  postType: PostType;
  personaContext?: string;
  carouselStyle?: CarouselStyle;
}

interface PromptHelperRequest {
  userInput: string;
  currentPrompt: string;
  referenceImages: string[];
  systemPrompt?: string;
}

interface CaptionHelperRequest {
  userRequest: string;
  currentCaption: string;
  imageUrls: string[];
  personaContext?: string;
  systemPrompt?: string;
}

type ClaudeJsonResult = Record<string, unknown>;

function getAnthropicApiKey(): string {
  const apiKey = process.env.ANTHROPIC_API_KEY || process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }
  return apiKey;
}

function stripMarkdownFences(text: string): string {
  let cleaned = text.trim();

  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  return cleaned.trim();
}

function getBrainstormSystemPrompt(mode: CreationMode, carouselStyle: CarouselStyle = "quick_snaps"): string {
  const raw = mode === "copy_post" ? COPY_POST_PROMPT : FROM_SCRATCH_PROMPT;
  return resolveCarouselStyle(raw, carouselStyle);
}

async function toClaudeImageBlock(image: string): Promise<ClaudeImageBlock | null> {
  const dataUriMatch = image.match(/^data:(.+?);base64,(.+)$/);
  if (dataUriMatch) {
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: dataUriMatch[1],
        data: dataUriMatch[2],
      },
    };
  }

  if (!image.startsWith("http://") && !image.startsWith("https://")) {
    return null;
  }

  const response = await fetch(image);
  if (!response.ok) {
    throw new Error(`Failed to load image for Claude: ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") || "image/jpeg";

  return {
    type: "image",
    source: {
      type: "base64",
      media_type: contentType,
      data: Buffer.from(arrayBuffer).toString("base64"),
    },
  };
}

async function buildClaudeContentBlocks(userMessage: string, images: string[] = []): Promise<ClaudeContentBlock[]> {
  const content: ClaudeContentBlock[] = [{ type: "text", text: userMessage }];

  for (const image of images) {
    const block = await toClaudeImageBlock(image);
    if (block) {
      content.push(block);
    }
  }

  return content;
}

async function claudeRequest({
  systemPrompt,
  userMessage,
  images = [],
  maxTokens = 2048,
  temperature = 0.8,
}: ClaudeRequestOptions): Promise<string> {
  const apiKey = getAnthropicApiKey();
  const content = await buildClaudeContentBlocks(userMessage, images);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: maxTokens,
      temperature,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(await extractClaudeErrorMessage(response));
  }

  const data = await response.json();
  const text = data.content
    ?.filter((item: { type?: string; text?: string }) => item.type === "text" && item.text)
    .map((item: { text: string }) => item.text)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("No response from Claude");
  }

  return text;
}

function parseClaudeJsonResponse<T>(text: string): T {
  return JSON.parse(stripMarkdownFences(text)) as T;
}

function buildBrainstormUserMessage(request: ClaudeBrainstormRequest): string {
  const contextParts: string[] = [];
  contextParts.push(`Post type: ${request.postType}`);
  contextParts.push(`Creation mode: ${request.creationMode}`);

  if (request.idea) {
    contextParts.push(`\nUser notes:\n${request.idea}`);
  }

  if (request.images.length > 0 && request.creationMode === "copy_post") {
    contextParts.push(`\n${request.images.length} reference image(s) attached. Analyze each one and create a recreation plan.`);
  } else if (request.images.length > 0) {
    contextParts.push(`\n${request.images.length} inspiration image(s) attached for reference.`);
  }

  return contextParts.join("\n");
}

export async function brainstormWithClaude(request: ClaudeBrainstormRequest): Promise<ClaudeJsonResult> {
  let systemPrompt = getBrainstormSystemPrompt(request.creationMode, request.carouselStyle || "quick_snaps");
  if (request.personaContext) {
    systemPrompt = `${request.personaContext}\n\n${systemPrompt}`;
  }

  const text = await claudeRequest({
    systemPrompt,
    userMessage: buildBrainstormUserMessage(request),
    images: request.images,
    maxTokens: 2048,
    temperature: DEFAULT_TRANSPARENCY.geminiConfig.temperature.brainstorm,
  });

  return parseClaudeJsonResponse(text);
}

export async function analyzeImagesWithClaude(
  images: string[],
  notes: string,
  personaContext?: string
): Promise<ClaudeJsonResult> {
  let systemPrompt = ANALYZE_OWN_IMAGES_PROMPT;
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  let userMessage = `I have ${images.length} image${images.length > 1 ? "s" : ""} to post on Instagram. Please analyze and generate appropriate post details.`;
  if (notes.trim()) {
    userMessage += `\n\nAdditional notes: ${notes}`;
  }

  const text = await claudeRequest({
    systemPrompt,
    userMessage,
    images,
    maxTokens: 1600,
    temperature: DEFAULT_TRANSPARENCY.geminiConfig.temperature.analyzeImages,
  });

  return parseClaudeJsonResponse(text);
}

export async function expandOwnImageForCarouselWithClaude(
  image: string,
  notes: string,
  personaContext?: string,
  carouselStyle?: CarouselStyle
): Promise<ClaudeJsonResult> {
  let systemPrompt = resolveCarouselStyle(EXPAND_CAROUSEL_PROMPT, carouselStyle || "quick_snaps");
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  let userMessage = "I have 1 image that I want to use as the first slide of an Instagram carousel (3 slides total). Please analyze it and generate 2 companion image prompts for slides 2-3 that create a cohesive set.";
  if (notes.trim()) {
    userMessage += `\n\nAdditional notes: ${notes}`;
  }

  const text = await claudeRequest({
    systemPrompt,
    userMessage,
    images: [image],
    maxTokens: 1800,
    temperature: DEFAULT_TRANSPARENCY.geminiConfig.temperature.expandCarousel,
  });

  return parseClaudeJsonResponse(text);
}

export async function generatePromptWithClaude({
  userInput,
  currentPrompt,
  referenceImages,
  systemPrompt,
}: PromptHelperRequest): Promise<string> {
  let userMessage = `User request: ${userInput}\n\n`;
  if (currentPrompt) {
    userMessage += `Current prompt: ${currentPrompt}\n\n`;
  }
  userMessage += `Reference images: ${referenceImages.length} image(s) attached.`;

  const text = await claudeRequest({
    systemPrompt: systemPrompt?.trim() || PROMPT_HELPER_PROMPT,
    userMessage,
    images: referenceImages,
    maxTokens: 700,
    temperature: 0.7,
  });

  return stripMarkdownFences(text);
}

export async function generateCaptionWithClaude({
  userRequest,
  currentCaption,
  imageUrls,
  personaContext,
  systemPrompt,
}: CaptionHelperRequest): Promise<string> {
  const activeSystemPrompt = systemPrompt?.trim() || CAPTION_HELPER_PROMPT;
  const resolvedSystemPrompt = personaContext?.trim()
    ? `${personaContext}\n\n${activeSystemPrompt}`
    : activeSystemPrompt;

  const userMessage = `Current caption: ${currentCaption?.trim() || "(none)"}\n\nRequest: ${userRequest.trim()}\n\nPlease write a new Instagram caption based on the image(s) and request above.`;

  const text = await claudeRequest({
    systemPrompt: resolvedSystemPrompt,
    userMessage,
    images: imageUrls.slice(0, 4),
    maxTokens: 700,
    temperature: 0.9,
  });

  return stripMarkdownFences(text).replace(/^["']|["']$/g, "");
}
