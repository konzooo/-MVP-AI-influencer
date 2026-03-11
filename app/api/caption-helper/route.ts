import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TRANSPARENCY } from "@/lib/transparency";
import { buildClaudeResponseHeaders, generateCaptionWithClaude } from "@/lib/claude";
import { isAIProvider } from "@/lib/ai-settings";
import { extractGeminiErrorMessage } from "@/lib/llm-errors";

const DEFAULT_SYSTEM_PROMPT = DEFAULT_TRANSPARENCY.geminiPrompts.captionHelperPrompt;

export async function POST(request: NextRequest) {
  const { userRequest, currentCaption, imageUrls = [], personaContext, systemPrompt, aiProvider } = await request.json();
  const provider = isAIProvider(aiProvider) ? aiProvider : "gemini";

  if (!userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest is required" }, { status: 400 });
  }

  if (provider === "claude") {
    try {
      const result = await generateCaptionWithClaude({
        userRequest,
        currentCaption,
        imageUrls: imageUrls || [],
        personaContext,
        systemPrompt,
      });

      return NextResponse.json(
        { caption: result.data },
        { headers: buildClaudeResponseHeaders(result.usage) }
      );
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Unknown error occurred" },
        { status: 500 }
      );
    }
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  // Build the Gemini request parts
  const parts: object[] = [];

  const userMessage = `Current caption: ${currentCaption?.trim() || "(none)"}

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

  const activeSystemPrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;
  const resolvedSystemPrompt = personaContext?.trim()
    ? `${personaContext}\n\n${activeSystemPrompt}`
    : activeSystemPrompt;

  const geminiPayload = {
    systemInstruction: { parts: [{ text: resolvedSystemPrompt }] },
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
    return NextResponse.json({ error: await extractGeminiErrorMessage(geminiRes) }, { status: 500 });
  }

  const geminiData = await geminiRes.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Strip any accidental surrounding quotes
  const caption = text.trim().replace(/^["']|["']$/g, "");

  return NextResponse.json(
    { caption },
    {
      headers: {
        "x-ai-provider": "gemini",
      },
    }
  );
}
