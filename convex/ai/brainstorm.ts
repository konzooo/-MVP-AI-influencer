"use node";

import { action } from "../_generated/server";
import { v } from "convex/values";

// ─── Brainstorm Action ────────────────────────────────────────────────────────
// Wraps the Gemini/Claude brainstorm logic for use in Convex actions (e.g. task runner)

export const run = action({
  args: {
    idea: v.string(),
    images: v.array(v.string()), // base64 data URIs
    creationMode: v.string(),
    postType: v.string(),
    personaContext: v.optional(v.string()),
    aiProvider: v.optional(v.string()),
    carouselStyle: v.optional(v.string()),
  },
  handler: async (_ctx, args) => {
    const { idea, images, creationMode, postType, personaContext, aiProvider, carouselStyle } = args;

    if (creationMode === "from_scratch" && aiProvider === "claude") {
      const anthropicKey = process.env.ANTHROPIC_API_KEY;
      if (anthropicKey) {
        try {
          return await brainstormWithClaude({
            idea,
            creationMode,
            postType,
            personaContext,
            carouselStyle: (carouselStyle as "quick_snaps" | "curated_series") || "quick_snaps",
            apiKey: anthropicKey,
          });
        } catch (err) {
          console.warn("[brainstorm] Claude failed, falling back to Gemini:", err);
        }
      }
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey) throw new Error("GEMINI_API_KEY not configured");

    return await brainstormWithGemini({
      idea,
      images,
      creationMode,
      postType,
      personaContext,
      carouselStyle: (carouselStyle as "quick_snaps" | "curated_series") || "quick_snaps",
      apiKey: geminiKey,
    });
  },
});

// ─── Gemini brainstorm ────────────────────────────────────────────────────────

async function brainstormWithGemini(params: {
  idea: string;
  images: string[];
  creationMode: string;
  postType: string;
  personaContext?: string;
  carouselStyle: "quick_snaps" | "curated_series";
  apiKey: string;
}) {
  const { idea, images, creationMode, postType, personaContext, carouselStyle, apiKey } = params;

  const systemPrompt = buildGeminiSystemPrompt(creationMode, carouselStyle, personaContext);

  const parts: object[] = [];
  const contextParts = [
    `Post type: ${postType}`,
    `Creation mode: ${creationMode}`,
  ];
  if (idea) contextParts.push(`\nUser notes:\n${idea}`);
  if (images.length > 0) {
    contextParts.push(`\n${images.length} reference image(s) attached.`);
  }
  parts.push({ text: contextParts.join("\n") });

  for (const dataUri of images) {
    const match = dataUri.match(/^data:(.+?);base64,(.+)$/);
    if (match) {
      parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
    }
  }

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

  if (!response.ok) {
    const error = await response.text();
    if (response.status === 429) throw new Error("Gemini API rate limit exceeded");
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No response from Gemini");
  return JSON.parse(text);
}

// ─── Claude brainstorm ────────────────────────────────────────────────────────

async function brainstormWithClaude(params: {
  idea: string;
  creationMode: string;
  postType: string;
  personaContext?: string;
  carouselStyle: "quick_snaps" | "curated_series";
  apiKey: string;
}) {
  const { idea, creationMode, postType, personaContext, carouselStyle, apiKey } = params;

  let userMessage = idea;
  if (postType === "carousel") {
    userMessage += `\n\nPost type: Instagram carousel (3 slides). Generate exactly 3 image prompts (one per slide).`;
  } else if (postType === "story") {
    userMessage += `\n\nPost type: Instagram story (vertical 9:16 format). Generate 1 concise image prompt.`;
  } else {
    userMessage += `\n\nPost type: ${postType}. Generate 1 image prompt.`;
  }

  let systemPrompt = buildClaudeSystemPrompt(carouselStyle);
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Claude API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.content?.[0]?.text;
  if (!text) throw new Error("No response from Claude");

  let cleaned = text.trim();
  if (cleaned.startsWith("```json")) cleaned = cleaned.slice(7);
  if (cleaned.startsWith("```")) cleaned = cleaned.slice(3);
  if (cleaned.endsWith("```")) cleaned = cleaned.slice(0, -3);
  return JSON.parse(cleaned.trim());
}

// ─── System Prompts ───────────────────────────────────────────────────────────

function buildCarouselInstruction(style: "quick_snaps" | "curated_series"): string {
  if (style === "quick_snaps") {
    return `For carousels: Generate exactly 3 imagePrompts. Slide 1 is the primary shot. Slides 2-3 should be quick pose/expression variations in the SAME scene — imagine 3 shots taken moments apart. Keep prompts SHORT (1-2 sentences) since slides 2-3 only need to describe what's different from slide 1.`;
  }
  return `For carousels: Generate exactly 3 imagePrompts. Each slide should be a distinct, carefully composed shot — different locations, lighting setups, or outfit variations from the same photoshoot. Each prompt should be DETAILED (3-4 sentences) and self-contained.`;
}

function buildGeminiSystemPrompt(creationMode: string, carouselStyle: "quick_snaps" | "curated_series", personaContext?: string): string {
  const carouselInstruction = buildCarouselInstruction(carouselStyle);

  const basePrompt = creationMode === "copy_post"
    ? `You are an expert Instagram content strategist for an AI influencer account. Analyze the provided reference image(s) and create a recreation plan that captures the same vibe, composition, and aesthetic but adapts it authentically. Return valid JSON matching exactly: {"title":"...","description":"...","caption":"...","hashtags":["..."],"imagePrompts":[{"prompt":"..."}],"notes":"..."}. Reference the character as "the character from Figure 1". Do NOT describe facial features or hair color. Return ONLY the JSON object.`
    : `You are an expert Instagram content strategist for an AI influencer account. Take rough ideas and turn them into complete post plans. Return valid JSON: {"title":"descriptive title like 'Santorini sunset, full body, white linen dress'","description":"1-2 sentence description","caption":"Instagram caption with \\n for line breaks","hashtags":["hashtag1"],"imagePrompts":[{"prompt":"Detailed scene prompt. Reference character as 'the character from Figure 1'. Describe pose, environment, lighting, clothing, mood — NOT facial features or hair color."}],"notes":"any tips"}. ${carouselInstruction} Return ONLY the JSON.`;

  return personaContext ? `${personaContext}\n\n${basePrompt}` : basePrompt;
}

function buildClaudeSystemPrompt(carouselStyle: "quick_snaps" | "curated_series"): string {
  const carouselInstruction = buildCarouselInstruction(carouselStyle);
  return `You are an expert Instagram content strategist and creative director for an AI influencer account.

CRITICAL RULE FOR TITLES: Write descriptive, specific titles that help the user quickly identify what the post is about.
Examples of GOOD titles: "Santorini sunset, full body, white linen dress", "Cozy bedroom carousel, different poses, warm tones"
Examples of BAD titles: "Beach Post", "New Content", "Photo 1"

The image generation prompt you write will be sent to an image generation model. When writing prompts:
- Reference the character as "the character from Figure 1"
- Do NOT describe specific facial features, hair color, or other identity traits
- DO describe: pose, environment, composition, lighting, clothing, mood, camera angle, style

Return your response as valid JSON:
{
  "title": "Descriptive title",
  "description": "1-2 sentence description",
  "caption": "Instagram caption with \\n for line breaks",
  "hashtags": ["hashtag1", "hashtag2"],
  "imagePrompts": [{"prompt": "Detailed prompt..."}],
  "notes": "Any additional notes"
}

${carouselInstruction}
Return ONLY the JSON object, no markdown code blocks or extra text.`;
}
