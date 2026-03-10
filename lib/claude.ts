import { CreationMode, PostType } from "./types";
import { DEFAULT_TRANSPARENCY, resolvePrompt } from "./transparency";
import type { CarouselStyle } from "./ai-settings";

// ─── System Prompts — single source of truth is lib/transparency.ts ──────────

const FROM_SCRATCH_PROMPT = DEFAULT_TRANSPARENCY.geminiPrompts.fromScratchPrompt;

// ─── Claude API Integration ──────────────────────────────────────────────────

interface ClaudeBrainstormRequest {
  idea: string;
  creationMode: CreationMode;
  postType: PostType;
  personaContext?: string;
  carouselStyle?: CarouselStyle;
}

export async function brainstormWithClaude(
  request: ClaudeBrainstormRequest
): Promise<any> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  let userMessage = request.idea;
  if (request.postType === "carousel") {
    userMessage += `\n\nPost type: Instagram carousel (3 slides). Generate exactly 3 image prompts (one per slide).`;
  } else if (request.postType === "story") {
    userMessage += `\n\nPost type: Instagram story (vertical 9:16 format). Generate 1 concise image prompt.`;
  } else {
    userMessage += `\n\nPost type: ${request.postType}. Generate 1 image prompt.`;
  }

  let systemPrompt = resolvePrompt(FROM_SCRATCH_PROMPT, { carouselStyle: request.carouselStyle || "quick_snaps" });
  if (request.personaContext) {
    systemPrompt = `${request.personaContext}\n\n${systemPrompt}`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error("Claude API error:", { status: response.status, error });
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;

  if (!text) {
    throw new Error("No response from Claude");
  }

  // Clean up markdown code blocks if present
  let cleaned = text;
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }

  const result = JSON.parse(cleaned.trim());
  return result;
}
