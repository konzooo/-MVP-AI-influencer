import { CreationMode, PostType } from "./types";
import { DEFAULT_TRANSPARENCY, resolveCarouselStyle } from "./transparency";
import type { CarouselStyle } from "./ai-settings";
import { extractClaudeErrorMessage } from "./llm-errors";

const CLAUDE_MODEL = "claude-3-5-sonnet-20241022";
const TOKENS_PER_MILLION = 1_000_000;
const CLAUDE_INPUT_COST_PER_MILLION_TOKENS_USD = 3;
const CLAUDE_OUTPUT_COST_PER_MILLION_TOKENS_USD = 15;

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

interface ClaudeApiUsage {
  input_tokens?: number;
  output_tokens?: number;
}

interface ClaudeApiResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: ClaudeApiUsage;
}

type ClaudeJsonResult = Record<string, unknown>;

export interface ClaudeUsageMetadata {
  model: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
}

export interface ClaudeResult<T> {
  data: T;
  usage: ClaudeUsageMetadata;
}

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

function getBrainstormSystemPrompt(
  mode: CreationMode,
  carouselStyle: CarouselStyle = "quick_snaps",
  imageCount = 0
): string {
  const raw = mode === "copy_post" ? COPY_POST_PROMPT : FROM_SCRATCH_PROMPT;
  return resolveCarouselStyle(raw, {
    style: carouselStyle,
    creationMode: mode,
    imageCount,
  });
}

function calculateClaudeCostUsd(usage: ClaudeApiUsage | undefined): number {
  const inputTokens = usage?.input_tokens ?? 0;
  const outputTokens = usage?.output_tokens ?? 0;

  const inputCost = (inputTokens / TOKENS_PER_MILLION) * CLAUDE_INPUT_COST_PER_MILLION_TOKENS_USD;
  const outputCost = (outputTokens / TOKENS_PER_MILLION) * CLAUDE_OUTPUT_COST_PER_MILLION_TOKENS_USD;

  return Number((inputCost + outputCost).toFixed(6));
}

function buildClaudeUsageMetadata(usage: ClaudeApiUsage | undefined): ClaudeUsageMetadata {
  return {
    model: CLAUDE_MODEL,
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    costUsd: calculateClaudeCostUsd(usage),
  };
}

export function buildClaudeResponseHeaders(usage: ClaudeUsageMetadata): Record<string, string> {
  return {
    "x-ai-provider": "claude",
    "x-ai-model": usage.model,
    "x-ai-cost-usd": usage.costUsd.toFixed(6),
    "x-ai-input-tokens": String(usage.inputTokens),
    "x-ai-output-tokens": String(usage.outputTokens),
  };
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
}: ClaudeRequestOptions): Promise<{ text: string; usage: ClaudeUsageMetadata }> {
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
      model: CLAUDE_MODEL,
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

  const data = (await response.json()) as ClaudeApiResponse;
  const text = data.content
    ?.filter((item) => item.type === "text" && item.text)
    .map((item) => item.text as string)
    .join("\n")
    .trim();

  if (!text) {
    throw new Error("No response from Claude");
  }

  return {
    text,
    usage: buildClaudeUsageMetadata(data.usage),
  };
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

export async function brainstormWithClaude(request: ClaudeBrainstormRequest): Promise<ClaudeResult<ClaudeJsonResult>> {
  let systemPrompt = getBrainstormSystemPrompt(
    request.creationMode,
    request.carouselStyle || "quick_snaps",
    request.images.length
  );
  if (request.personaContext) {
    systemPrompt = `${request.personaContext}\n\n${systemPrompt}`;
  }

  const response = await claudeRequest({
    systemPrompt,
    userMessage: buildBrainstormUserMessage(request),
    images: request.images,
    maxTokens: 2048,
    temperature: DEFAULT_TRANSPARENCY.geminiConfig.temperature.brainstorm,
  });

  return {
    data: parseClaudeJsonResponse(response.text),
    usage: response.usage,
  };
}

export async function analyzeImagesWithClaude(
  images: string[],
  notes: string,
  personaContext?: string
): Promise<ClaudeResult<ClaudeJsonResult>> {
  let systemPrompt = ANALYZE_OWN_IMAGES_PROMPT;
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  let userMessage = `I have ${images.length} image${images.length > 1 ? "s" : ""} to post on Instagram. Please analyze and generate appropriate post details.`;
  if (notes.trim()) {
    userMessage += `\n\nAdditional notes: ${notes}`;
  }

  const response = await claudeRequest({
    systemPrompt,
    userMessage,
    images,
    maxTokens: 1600,
    temperature: DEFAULT_TRANSPARENCY.geminiConfig.temperature.analyzeImages,
  });

  return {
    data: parseClaudeJsonResponse(response.text),
    usage: response.usage,
  };
}

export async function expandOwnImageForCarouselWithClaude(
  image: string,
  notes: string,
  personaContext?: string,
  carouselStyle?: CarouselStyle
): Promise<ClaudeResult<ClaudeJsonResult>> {
  let systemPrompt = resolveCarouselStyle(EXPAND_CAROUSEL_PROMPT, {
    style: carouselStyle || "quick_snaps",
    creationMode: "from_own_images",
    imageCount: 1,
  });
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  let userMessage = "I have 1 image that I want to use as the first slide of an Instagram carousel (3 slides total). Please analyze it and generate 2 companion image prompts for slides 2-3 that create a cohesive set.";
  if (notes.trim()) {
    userMessage += `\n\nAdditional notes: ${notes}`;
  }

  const response = await claudeRequest({
    systemPrompt,
    userMessage,
    images: [image],
    maxTokens: 1800,
    temperature: DEFAULT_TRANSPARENCY.geminiConfig.temperature.expandCarousel,
  });

  return {
    data: parseClaudeJsonResponse(response.text),
    usage: response.usage,
  };
}

export async function generatePromptWithClaude({
  userInput,
  currentPrompt,
  referenceImages,
  systemPrompt,
}: PromptHelperRequest): Promise<ClaudeResult<string>> {
  let userMessage = `User request: ${userInput}\n\n`;
  if (currentPrompt) {
    userMessage += `Current prompt: ${currentPrompt}\n\n`;
  }
  userMessage += `Reference images: ${referenceImages.length} image(s) attached.`;

  const response = await claudeRequest({
    systemPrompt: systemPrompt?.trim() || PROMPT_HELPER_PROMPT,
    userMessage,
    images: referenceImages,
    maxTokens: 700,
    temperature: 0.7,
  });

  return {
    data: stripMarkdownFences(response.text),
    usage: response.usage,
  };
}

export async function generateCaptionWithClaude({
  userRequest,
  currentCaption,
  imageUrls,
  personaContext,
  systemPrompt,
}: CaptionHelperRequest): Promise<ClaudeResult<string>> {
  const activeSystemPrompt = systemPrompt?.trim() || CAPTION_HELPER_PROMPT;
  const resolvedSystemPrompt = personaContext?.trim()
    ? `${personaContext}\n\n${activeSystemPrompt}`
    : activeSystemPrompt;

  const userMessage = `Current caption: ${currentCaption?.trim() || "(none)"}\n\nRequest: ${userRequest.trim()}\n\nPlease write a new Instagram caption based on the image(s) and request above.`;

  const response = await claudeRequest({
    systemPrompt: resolvedSystemPrompt,
    userMessage,
    images: imageUrls.slice(0, 4),
    maxTokens: 700,
    temperature: 0.9,
  });

  return {
    data: stripMarkdownFences(response.text).replace(/^["']|["']$/g, ""),
    usage: response.usage,
  };
}
