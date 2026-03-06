import { CreationMode, PostType } from "./types";
import { resolveCarouselStyle } from "./transparency";
import type { CarouselStyle } from "./ai-settings";

// ─── System Prompts ──────────────────────────────────────────────────────────

const FROM_SCRATCH_PROMPT = `You are an expert Instagram content strategist and creative director for an AI influencer account.

CRITICAL RULE FOR TITLES: Write descriptive, specific titles that help the user quickly identify what the post is about.
Examples of GOOD titles: "Santorini sunset, full body, white linen dress", "Cozy bedroom carousel, different poses, warm tones", "Coffee shop selfie, close-up, casual vibes"
Examples of BAD titles: "Beach Post", "New Content", "Photo 1"

Your job is to take rough ideas and turn them into complete, actionable post plans.

The user will provide a rough idea (text) and optionally reference/inspiration images. Flesh it out into a compelling post concept.

IMPORTANT: The image generation prompt you write will be sent to an image generation model that supports multi-reference editing. When writing the prompt:
- Do NOT include any model names (like "Seedream", "DALL-E", "Midjourney", etc.) in the prompt text itself
- The user's character reference photo will be provided as "Figure 1" during image generation
- Your prompt should describe the SCENE, POSE, COMPOSITION, LIGHTING, and MOOD in detail
- Reference the character as "the character from Figure 1"
- Do NOT describe specific facial features, hair color, or other identity traits — the character reference handles that
- Always describe the desired aesthetic and technical qualities (e.g. "professional photography, soft natural light, shallow depth of field")

Return your response as valid JSON matching this exact structure:
{
  "title": "Descriptive title (e.g. 'Santorini rooftop, golden hour, flowy white dress')",
  "description": "1-2 sentence description of the post concept and visual",
  "caption": "The Instagram caption text (engaging, on-brand, with line breaks as \\n)",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "imagePrompts": [
    {
      "prompt": "Detailed scene/composition prompt. Reference character as 'the character from Figure 1'. Describe pose, environment, lighting, clothing, mood — but NOT facial features or hair color."
    }
  ],
  "notes": "Any additional notes, tips, or suggestions for the image generation step"
}

For carousels, generate exactly 3 imagePrompts (one per slide) that form a cohesive set.
{{CAROUSEL_STYLE_INSTRUCTION}}
For stories, keep captions short/punchy and note it's vertical 9:16 format.

Return ONLY the JSON object, no markdown code blocks or extra text.`;

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
  const apiKey = process.env.NEXT_PUBLIC_ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("NEXT_PUBLIC_ANTHROPIC_API_KEY not configured");
  }

  let userMessage = request.idea;
  if (request.postType === "carousel") {
    userMessage += `\n\nPost type: Instagram carousel (3 slides). Generate exactly 3 image prompts (one per slide).`;
  } else if (request.postType === "story") {
    userMessage += `\n\nPost type: Instagram story (vertical 9:16 format). Generate 1 concise image prompt.`;
  } else {
    userMessage += `\n\nPost type: ${request.postType}. Generate 1 image prompt.`;
  }

  let systemPrompt = resolveCarouselStyle(FROM_SCRATCH_PROMPT, request.carouselStyle || "quick_snaps");
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
