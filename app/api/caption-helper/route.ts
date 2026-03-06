import { NextRequest, NextResponse } from "next/server";

const SYSTEM_PROMPT = `You are a creative Instagram caption writer for an AI influencer.

You will receive:
- One or more images (the post's selected photos)
- The current caption (may be empty)
- A request from the user describing what kind of caption they want

Your job is to write a new Instagram caption based on all of this context.

Guidelines:
- Write in first person as the influencer
- Match the mood and vibe of the images
- Keep it authentic and conversational — not corporate or over-produced
- Use natural line breaks (\\n) between thoughts
- Do NOT include hashtags — those are handled separately
- Length should match the request: if they ask for "minimal" keep it 1-2 lines; if they ask for "longer" or "storytelling" go up to 4-6 lines
- Do NOT wrap the output in quotes or add any explanation — return ONLY the caption text itself`;

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
  }

  const { userRequest, currentCaption, imageUrls } = await request.json();

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
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
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
