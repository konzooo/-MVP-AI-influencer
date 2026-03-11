import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TRANSPARENCY } from "@/lib/transparency";

const DEFAULT_SYSTEM_PROMPT = DEFAULT_TRANSPARENCY.geminiPrompts.promptHelperPrompt;

interface PromptHelperRequest {
  userInput: string;
  currentPrompt: string;
  referenceImages: string[]; // base64 data URIs
  systemPrompt?: string;
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

    const body = (await request.json()) as PromptHelperRequest;
    const { userInput, currentPrompt, referenceImages, systemPrompt } = body;

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

    const activeSystemPrompt = systemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT;

    // Call Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: activeSystemPrompt }],
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
