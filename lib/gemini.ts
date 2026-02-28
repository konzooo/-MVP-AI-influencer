import { CreationMode, PostType } from "./types";

// ─── System Prompts ──────────────────────────────────────────────────────────

const SHARED_PREAMBLE = `You are an expert Instagram content strategist and creative director for an AI influencer account.

CRITICAL RULE FOR TITLES: Write descriptive, specific titles that help the user quickly identify what the post is about. 
Examples of GOOD titles: "Santorini sunset, full body, white linen dress", "Cozy bedroom carousel, different poses, warm tones", "Coffee shop selfie, close-up, casual vibes"
Examples of BAD titles: "Beach Post", "New Content", "Photo 1"`;

const FROM_SCRATCH_PROMPT = `${SHARED_PREAMBLE}

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

For carousels, generate multiple imagePrompts (one per slide) that form a cohesive set.
For stories, keep captions short/punchy and note it's vertical 9:16 format.

Return ONLY the JSON object, no markdown code blocks or extra text.`;

const COPY_POST_PROMPT = `${SHARED_PREAMBLE}

Your job is to analyze reference images of existing Instagram posts and create a plan to RECREATE them with the user's AI character.

The user will upload one or more images of posts they want to replicate. For EACH image, you must:

1. **Analyze the image thoroughly** — create a structured description covering:
   - Pose & body language (stance, hand position, head tilt, gaze direction)
   - Environment & setting (location, background elements, props)
   - Composition & framing (close-up, full body, angle, rule of thirds)
   - Lighting (natural/artificial, direction, warmth, shadows)
   - Mood & atmosphere (vibe, energy, color grading)
   - Clothing & accessories (what they're wearing, style)
   - ALSO note the person's identity features (hair color/style, skin tone, distinguishing features) — but ONLY in the analysis, NOT in the generation prompt

2. **Write an image generation prompt** that recreates everything EXCEPT the identity:
   - Describe the exact pose, environment, lighting, composition, clothing, and mood
   - Reference the character as "the character from Figure 1" (the user's character reference will be Figure 1 during generation)
   - Do NOT mention hair color, skin tone, facial features, or other identity-specific traits in the prompt
   - This is critical: if the reference shows a blonde woman, do NOT write "blonde woman" in the prompt — that would conflict with the character reference

Return your response as valid JSON matching this exact structure:
{
  "title": "Descriptive title (e.g. 'Mirror selfie recreation, gym outfit, bright lighting')",
  "description": "1-2 sentence description of what we're recreating",
  "caption": "Instagram caption text (engaging, on-brand, with line breaks as \\n)",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "imagePrompts": [
    {
      "prompt": "Detailed recreation prompt. Describes pose, environment, lighting, clothing, mood — references character as 'the character from Figure 1'. NO identity features.",
      "referenceImageAnalysis": "Detailed structured analysis of the source image: pose, environment, composition, lighting, mood, clothing, AND the original person's identity features (for transparency only, not used in generation)"
    }
  ],
  "notes": "Differences to watch for, potential challenges, tips for getting the best result"
}

For single images (single post or story), create one imagePrompt.
For stories, note the vertical 9:16 format.

For carousels with multiple source images:
- Create one imagePrompt per source image
- Slide 1 prompt should be full and detailed (pose, environment, lighting, clothing, mood)
- Slides 2-4 prompts should be SHORT — only describe what changes (pose and/or expression)
  - Always add: "Same scene, lighting, outfit, and mood as Figure 1" (Figure 1 will be the first generated slide used as consistency reference)
  - Example: "The character from Figure 1 laughing and looking to the side, arms crossed. Same scene, lighting, outfit, and mood as Figure 1."
  - Do NOT repeat the full scene description for every slide — that causes drift. Keep it to 1-2 sentences.

IMPORTANT: The referenceImageAnalysis is shown to the user for transparency so they can see what the AI detected. Include identity features there (hair color, etc.) so the user can verify the AI understood the image — but keep them OUT of the generation prompt.

Return ONLY the JSON object, no markdown code blocks or extra text.`;

// ─── Prompt selector ─────────────────────────────────────────────────────────

function getSystemPrompt(mode: CreationMode): string {
  return mode === "copy_post" ? COPY_POST_PROMPT : FROM_SCRATCH_PROMPT;
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

// ─── API Call ────────────────────────────────────────────────────────────────

export async function brainstormWithGemini(
  req: BrainstormRequest,
  apiKey: string,
  personaContext?: string
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

  let systemPrompt = getSystemPrompt(req.creationMode);
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error details:", {
      status: response.status,
      statusText: response.statusText,
      error,
      url: response.url,
    });
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini");
  }

  // Parse the JSON response
  const plan = JSON.parse(text);
  return plan;
}

// ─── Image Analysis for Own Images ──────────────────────────────────────────

const ANALYZE_OWN_IMAGES_PROMPT = `You are an expert Instagram content strategist analyzing user-provided images for posting.

The user has uploaded their own final images (not inspiration or references) and wants you to analyze them and generate appropriate post details.

Your job:
1. Analyze what's in the images (setting, mood, style, subject, colors, vibe)
2. Generate an engaging Instagram caption that fits the content
3. Suggest relevant hashtags
4. Write a descriptive title for internal organization

Guidelines for captions:
- Write in first person as the AI influencer
- Be authentic, engaging, and conversational
- Match the mood/vibe of the images
- Include 2-4 lines with natural line breaks (use \\n)
- Don't over-explain — let the images speak

Return your response as valid JSON matching this structure:
{
  "title": "Short descriptive title for internal use (e.g. 'Coffee shop morning vibes')",
  "description": "Brief 1-sentence description of the images",
  "caption": "Instagram caption text (engaging, on-brand, with line breaks as \\n)",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "postType": "single_image" or "carousel" (carousel if multiple images provided)
}

Return ONLY the JSON object, no markdown code blocks or extra text.`;

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

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.7,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error details:", {
      status: response.status,
      statusText: response.statusText,
      error,
      url: response.url,
    });
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini");
  }

  const result = JSON.parse(text);
  return result;
}

// ─── Expand Own Image into Carousel ─────────────────────────────────────────

const EXPAND_OWN_IMAGE_CAROUSEL_PROMPT = `${SHARED_PREAMBLE}

The user has uploaded their own image that will be used as the FIRST slide of an Instagram carousel. The first slide is already done — your job is to create 3 companion image prompts for slides 2, 3, and 4, plus post details.

The companion slides should feel like the person casually snapped a few photos in the same session — same place, same outfit, same vibe — just a different pose, angle, or expression. Like scrolling through someone's photo dump. Do NOT re-describe the outfit or setting in detail; instead, reference the first image as the source of truth.

Guidelines for companion prompts (slides 2, 3, 4):
- ALWAYS start with: "The character from Figure 1, in the same setting and outfit as Figure 1,"
- Then add a SHORT variation instruction: a different pose, angle, expression, or subtle action
- Keep prompts concise (1-2 sentences max) — do NOT write a detailed scene description
- Think: "same photoshoot, casual next shot" energy
- Do NOT describe facial features, clothing details, hair, or setting from scratch — Figure 1 is the reference

Example prompts:
- "The character from Figure 1, in the same setting and outfit as Figure 1, slightly turned to the side with a more relaxed pose."
- "The character from Figure 1, in the same setting and outfit as Figure 1, looking down or away with a candid, unposed expression."
- "The character from Figure 1, in the same setting and outfit as Figure 1, leaning against the wall with arms crossed, full body visible."

Guidelines for captions:
- Write in first person as the AI influencer
- Be authentic, engaging, and conversational
- Match the mood/vibe of the images
- Include 2-4 lines with natural line breaks (use \\n)

Return your response as valid JSON matching this exact structure:
{
  "title": "Descriptive title (e.g. 'Apartment mirror selfies, edgy chic outfit, 4-slide set')",
  "description": "1-2 sentence description of the carousel concept",
  "caption": "Instagram caption text (engaging, on-brand, with line breaks as \\n)",
  "hashtags": ["hashtag1", "hashtag2", ...],
  "imagePrompts": [
    {
      "prompt": "The character from Figure 1, in the same setting and outfit as Figure 1, [short variation for slide 2]."
    },
    {
      "prompt": "The character from Figure 1, in the same setting and outfit as Figure 1, [short variation for slide 3]."
    },
    {
      "prompt": "The character from Figure 1, in the same setting and outfit as Figure 1, [short variation for slide 4]."
    }
  ],
  "notes": "Brief tip for keeping the carousel cohesive"
}

Return ONLY the JSON object, no markdown code blocks or extra text.`;

export async function expandOwnImageForCarousel(
  image: string, // base64 data URI of the user's image
  notes: string,
  apiKey: string,
  personaContext?: string
) {
  const parts: GeminiPart[] = [];

  let userMessage = `I have 1 image that I want to use as the first slide of an Instagram carousel. Please analyze it and generate 3 companion image prompts for slides 2-4 that create a cohesive set.`;

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
  }

  let systemPrompt = EXPAND_OWN_IMAGE_CAROUSEL_PROMPT;
  if (personaContext) {
    systemPrompt = `${personaContext}\n\n${systemPrompt}`;
  }

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [{ parts }],
        generationConfig: {
          temperature: 0.8,
          responseMimeType: "application/json",
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("Gemini API error details:", {
      status: response.status,
      statusText: response.statusText,
      error,
      url: response.url,
    });
    throw new Error(`Gemini API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("No response from Gemini");
  }

  const result = JSON.parse(text);
  return result;
}
