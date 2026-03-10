import { NextRequest, NextResponse } from "next/server";

function buildSystemPrompt(promptStyle?: string): string {
  const basePrompt = `You are an expert at writing prompts for Seedream 4.5, an advanced image generation model that uses natural language prompts and reference images.

Your job is to help users create or improve prompts based on their needs. You will receive:
1. The user's natural language request (what they want to change/create)
2. Their current prompt (if any)
3. Reference images they're using

CRITICAL SEEDREAM 4.5 PROMPT RULES:
- Reference images are provided as "Figure 1", "Figure 2", etc. Always use these references in your prompts.
- For character consistency, the prompt should reference "the character from Figure 1" (or whichever figure is the character reference).
- DO NOT describe identity features like hair color, skin tone, or facial structure — the reference image handles that.
- DO describe: pose, environment, composition, lighting, clothing, mood, camera angle, style.
- Be specific about technical qualities: "professional photography", "soft natural light", "shallow depth of field", "35mm lens", etc.
- Keep prompts concise but detailed — aim for 2-4 sentences.

COMMON USE CASES:
1. **Starting from scratch**: User has reference images but no prompt yet.
   → Analyze the references and create a complete prompt.

2. **Improving existing prompt**: User has a prompt but wants changes.
   → Keep what works, modify what they asked for, maintain Seedream best practices.

3. **Simple variations**: "Make her swimming", "Change to sunset", etc.
   → Keep the core prompt structure, swap out the specific element.

4. **Fixing issues**: "Make lighting more dramatic", "More relaxed pose", etc.
   → Identify the relevant part of the prompt and enhance it.

OUTPUT FORMAT:
Return ONLY the optimized prompt as plain text. No markdown, no explanations, no code blocks.
Just the prompt string ready to be used with Seedream 4.5.

EXAMPLE INPUTS AND OUTPUTS:

Input: "Help me create an image of her swimming"
Current prompt: ""
Output: "Create a photo of the character from Figure 1 swimming in clear turquoise water, waist-up framing, arms mid-stroke. Underwater perspective with sunlight rays filtering through the water. Natural outdoor lighting, bright and vibrant colors, professional sports photography style."

Input: "Make the lighting more dramatic"
Current prompt: "Create a photo of the character from Figure 1 standing in a bedroom, soft natural light."
Output: "Create a photo of the character from Figure 1 standing in a bedroom, dramatic side lighting casting strong shadows across her face. Hard directional light from a single window, moody atmosphere, high contrast, cinematic style."

Input: "Change to a beach at sunset"
Current prompt: "Create a photo of the character from Figure 1 in a cozy living room, warm lamp light."
Output: "Create a photo of the character from Figure 1 on a beach at golden hour, warm sunset glow, silhouette with rim lighting. Feet in the sand, waves in background, relaxed pose looking at the ocean. Professional photography, shallow depth of field, warm color grading."`;

  if (promptStyle?.trim()) {
    return `${basePrompt}

Your job is to help users create or improve prompts based on their needs. You will receive:
1. The user's natural language request (what they want to change/create)
2. Their current prompt (if any)
3. Reference images they're using

STYLE GUIDE FOR PROMPTS YOU CREATE:
${promptStyle}

${SEEDREAM_RULES}

${COMMON_USE_CASES}

${OUTPUT_FORMAT}`;
  }

  return `${basePrompt}

Your job is to help users create or improve prompts based on their needs. You will receive:
1. The user's natural language request (what they want to change/create)
2. Their current prompt (if any)
3. Reference images they're using

${SEEDREAM_RULES}

${COMMON_USE_CASES}

${OUTPUT_FORMAT}`;
}

const SEEDREAM_RULES = `CRITICAL SEEDREAM 4.5 PROMPT RULES:
- Reference images are provided as "Figure 1", "Figure 2", etc. Always use these references in your prompts.
- For character consistency, the prompt should reference "the character from Figure 1" (or whichever figure is the character reference).
- DO NOT describe identity features like hair color, skin tone, or facial structure — the reference image handles that.
- DO describe: pose, environment, composition, lighting, clothing, mood, camera angle, style.
- Be specific about technical qualities: "professional photography", "soft natural light", "shallow depth of field", "35mm lens", etc.
- Keep prompts concise but detailed — aim for 2-4 sentences.`;

const COMMON_USE_CASES = `COMMON USE CASES:
1. **Starting from scratch**: User has reference images but no prompt yet.
   → Analyze the references and create a complete prompt.

2. **Improving existing prompt**: User has a prompt but wants changes.
   → Keep what works, modify what they asked for, maintain Seedream best practices.

3. **Simple variations**: "Make her swimming", "Change to sunset", etc.
   → Keep the core prompt structure, swap out the specific element.

4. **Fixing issues**: "Make lighting more dramatic", "More relaxed pose", etc.
   → Identify the relevant part of the prompt and enhance it.`;

const OUTPUT_FORMAT = `OUTPUT FORMAT:
Return ONLY the optimized prompt as plain text. No markdown, no explanations, no code blocks.
Just the prompt string ready to be used with Seedream 4.5.`;

interface PromptHelperRequest {
  userInput: string;
  currentPrompt: string;
  referenceImages: string[]; // base64 data URIs
}

interface GeminiPart {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    interface RequestBody extends PromptHelperRequest {
      promptStyle?: string;
    }
    const body = (await request.json()) as RequestBody;
    const { userInput, currentPrompt, referenceImages, promptStyle } = body;

    if (!userInput.trim()) {
      return NextResponse.json(
        { error: "Please describe what you need" },
        { status: 400 }
      );
    }

    // Build the user message with context
    const parts: GeminiPart[] = [];

    let contextMessage = `User request: ${userInput}\n\n`;
    if (currentPrompt) {
      contextMessage += `Current prompt: ${currentPrompt}\n\n`;
    }
    contextMessage += `Reference images: ${referenceImages.length} image(s) attached.`;

    parts.push({ text: contextMessage });

    // Add reference images
    for (const dataUri of referenceImages) {
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

    // Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: buildSystemPrompt(promptStyle) }],
          },
          contents: [{ parts }],
          generationConfig: {
            temperature: 0.7,
          },
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      console.error("Gemini API error:", {
        status: response.status,
        error,
      });
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const prompt = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!prompt) {
      throw new Error("No prompt generated");
    }

    // Clean up any markdown artifacts
    const cleanPrompt = prompt
      .replace(/```[\s\S]*?```/g, "") // Remove code blocks
      .replace(/^#+\s+/gm, "") // Remove markdown headers
      .trim();

    return NextResponse.json({ prompt: cleanPrompt });
  } catch (error) {
    console.error("Prompt helper error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
