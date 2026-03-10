import { NextRequest, NextResponse } from "next/server";

interface CaptionHelperRequest {
  userRequest: string;
  currentCaption: string;
  imageUrls: string[];
  captionStyle?: string;
  identityContext?: string; // persona name, tone, language
}

function buildSystemPrompt(captionStyle?: string, identityContext?: string): string {
  const baseGuidelines = `You are a creative Instagram caption writer for an AI influencer.

CONTEXT:
You will receive:
- One or more images (the post's selected photos)
- The current caption (may be empty or a draft)
- A specific request from the user describing what they want changed or improved
- The character/influencer's personal style guide (if available)

YOUR JOB:
Write an improved Instagram caption that:
1. Incorporates the user's request (e.g., "make it more fun", "shorten it", "add a question")
2. Maintains the influencer's authentic voice and style
3. Matches the mood and vibe of the images
4. Feels natural and conversational, not corporate
5. Uses natural line breaks (\\n) between thoughts for readability

CRITICAL OUTPUT RULES:
- Do NOT include hashtags — those are handled separately
- Do NOT wrap the output in quotes or add explanations
- Return ONLY the improved caption text itself
- Preserve the core message if there's an existing caption; refine and improve it
- LENGTH: Maximum 2 lines unless the user explicitly requests more — short is the style, not a constraint to work around`;

  const identitySection = identityContext?.trim()
    ? `\n\nINFLUENCER PERSONA:\n${identityContext}`
    : "";

  if (captionStyle?.trim()) {
    return `${baseGuidelines}${identitySection}

INFLUENCER'S STYLE GUIDE:
${captionStyle}

Follow this style guide closely when writing captions.`;
  }

  return `${baseGuidelines}

DEFAULT GUIDELINES (when no style guide is set):
- Keep it SHORT — 1-2 lines maximum unless the user explicitly asks for more
- Be witty, punchy, and a little poetic — not corporate or over-explained
- Let the image do the talking; the caption adds a spark, not a description
- Use emojis sparingly (0-1), only if they truly fit
- No filler phrases like "Embracing the moment" or "Living my best life"
- Match the mood: cozy = warmth, fun = playful, bold = confident`;
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { userRequest, currentCaption, imageUrls, captionStyle, identityContext } = (await request.json()) as CaptionHelperRequest;

  if (!userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest is required" }, { status: 400 });
  }

  // Build the Gemini request parts
  const parts: object[] = [];

  let userMessage = `Current caption: ${currentCaption?.trim() || "(none)"}

Request: ${userRequest.trim()}

Please write a new Instagram caption based on the image(s) and request above.`;

  parts.push({ text: userMessage });

  // Attach images if provided (fetch and convert to base64)
  if (imageUrls && imageUrls.length > 0) {
    for (const url of imageUrls.slice(0, 4)) {
      try {
        if (url.startsWith("data:")) {
          const match = url.match(/^data:(.+?);base64,(.+)$/);
          if (match) {
            parts.push({ inlineData: { mimeType: match[1], data: match[2] } });
          }
        } else {
          // Fetch remote URL and convert to base64
          const res = await fetch(url);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const base64 = Buffer.from(buffer).toString("base64");
            const contentType = res.headers.get("content-type") || "image/jpeg";
            parts.push({ inlineData: { mimeType: contentType, data: base64 } });
          }
        }
      } catch {
        // Skip images that fail to load
      }
    }
  }

  const geminiPayload = {
    systemInstruction: { parts: [{ text: buildSystemPrompt(captionStyle, identityContext) }] },
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.9,
      maxOutputTokens: 512,
    },
  };

  const geminiRes = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(geminiPayload),
    }
  );

  if (!geminiRes.ok) {
    const err = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 });
  }

  const geminiData = await geminiRes.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Strip any accidental surrounding quotes
  const caption = text.trim().replace(/^["']|["']$/g, "");

  return NextResponse.json({ caption });
}
