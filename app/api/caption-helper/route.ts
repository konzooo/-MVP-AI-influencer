import { NextRequest, NextResponse } from "next/server";
import { DEFAULT_TRANSPARENCY } from "@/lib/transparency";

const DEFAULT_SYSTEM_PROMPT = DEFAULT_TRANSPARENCY.geminiPrompts.captionHelperPrompt;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { userRequest, currentCaption, imageUrls, personaContext, systemPrompt } = await request.json();

  if (!userRequest?.trim()) {
    return NextResponse.json({ error: "userRequest is required" }, { status: 400 });
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
    const err = await geminiRes.text();
    return NextResponse.json({ error: `Gemini error: ${err}` }, { status: 500 });
  }

  const geminiData = await geminiRes.json();
  const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

  // Strip any accidental surrounding quotes
  const caption = text.trim().replace(/^["']|["']$/g, "");

  return NextResponse.json({ caption });
}
