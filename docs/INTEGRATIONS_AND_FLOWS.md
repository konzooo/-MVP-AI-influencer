# AI Influencer — Integrations & Background Flows

This document explains the **background flows** in the app (what we send, what we store, what we get back) for:

- **Gemini** (Creative Lab brainstorm + image analysis, and Prompt Helper)
- **fal.ai** (Seedream 4.5 image generation + optional storage upload)
- **Local persistence** rules (what is kept vs. intentionally not persisted)

It’s intended as a “single source of truth” for debugging, prompt iteration, and future refactors.

---

## 1) Core concepts

### Identity-safe prompting (critical)

We deliberately **separate “identity features”** from prompts to avoid conflicts with the user’s character reference / LoRA.

- **Allowed in prompts**: scene, pose, composition, lighting, mood, clothing, camera/lens/style, quality cues
- **NOT allowed in prompts**: facial features, hair style/color, skin tone, tattoos, distinguishing identity traits
- **How we refer to the character**: `"the character from Figure 1"`

> When “copying” an existing post, we *may* include identity features **only in the analysis text shown to the user** for transparency (never in the final generation prompt).

---

## 2) Creative Lab → Gemini brainstorm flow

### API route

- **Endpoint**: `POST /api/brainstorm`
- **Server code**: `app/api/brainstorm/route.ts`
- **Gemini helper**: `lib/gemini.ts`

### Request body (client → server)

```json
{
  "idea": "string (optional if images provided)",
  "images": ["data:image/png;base64,...", "..."],
  "creationMode": "from_scratch | copy_post",
  "postType": "single_image | carousel | reel_cover | story"
}
```

Notes:
- `images` are **base64 data URIs** (clipboard/drag-drop upload data).
- `creationMode` selects which system prompt is used (see below).

### What we send to Gemini

- **Model**: `gemini-2.5-flash`
- **Method**: `generateContent`
- **systemInstruction**: one of:
  - `FROM_SCRATCH_PROMPT` (when `creationMode === "from_scratch"`)
  - `COPY_POST_PROMPT` (when `creationMode === "copy_post"`)
- **contents.parts**:
  - One text “context message” including:
    - `Post type: ...`
    - `Creation mode: ...`
    - `User notes: ...` (if provided)
    - A line about how many images are attached
  - Then each image is appended as an `inlineData` part (mimeType + base64 payload)

Source: `lib/gemini.ts` builds `parts` and then calls:

- URL: `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=...`
- generationConfig:
  - `temperature: 0.8`
  - `responseMimeType: "application/json"` (Creative Lab expects JSON)

### Creative Lab system prompts (exact)

These live in `lib/gemini.ts`:

- `SHARED_PREAMBLE`
- `FROM_SCRATCH_PROMPT`
- `COPY_POST_PROMPT`

Key rules embedded in the prompts:
- Titles must be **highly descriptive**
- Seedream prompting:
  - character reference is **Figure 1**
  - reference the subject as `"the character from Figure 1"`
  - **do not** describe identity features in the generation prompt
- Copy-post mode additionally asks for `referenceImageAnalysis`

### Expected Gemini JSON output (server → client)

Gemini is instructed to return a JSON object with:

```json
{
  "title": "string",
  "description": "string",
  "caption": "string (may include \\n)",
  "hashtags": ["string"],
  "imagePrompts": [
    {
      "prompt": "string",
      "referenceImageAnalysis": "string (copy_post only, optional in schema)"
    }
  ],
  "notes": "string"
}
```

How the UI uses it:
- `imagePrompts[].prompt` pre-fills tabs on the Image Generation page.
- `imagePrompts[].referenceImageAnalysis` is shown as a read-only expandable section (transparency).

---

## 3) Image Generation → fal.ai (Seedream 4.5)

### API route

- **Endpoint**: `POST /api/generate`
- **Server code**: `app/api/generate/route.ts`
- **fal helper**: `lib/fal.ts`

### Request body (client → server)

```json
{
  "prompt": "string",
  "imageUrls": ["string", "..."],
  "imageSize": "square_hd | ... (optional)",
  "numImages": 1,
  "maxImages": 1,
  "seed": 12345,
  "enableSafetyChecker": true
}
```

Important:
- `imageUrls` must include at least 1 image. In practice:
  - Figure 1 is typically the user’s character reference
  - Additional references can be added per tab

### What we send to fal.ai (server → fal.ai)

We use the official SDK `@fal-ai/client` (see `lib/fal.ts`).

- **Endpoint / model**: `fal-ai/bytedance/seedream/v4.5/edit`
- **SDK method**: `fal.subscribe(...)`
- **input payload** (SDK):
  - `prompt`: string
  - `image_urls`: array of URLs (or sometimes a data URI as fallback)
  - `image_size`: defaults to `"square_hd"`
  - `num_images`: defaults to `1`
  - `max_images`: defaults to `1`
  - optional `seed`
  - `enable_safety_checker`: defaults to `true`

### Response shape (fal.ai → server → client)

We normalize to:

```json
{
  "images": [
    {
      "url": "https://...",
      "width": 1024,
      "height": 1024,
      "content_type": "image/jpeg"
    }
  ]
}
```

Implementation detail:
- Some SDK responses can be nested under `result.data.images`; we handle both in `lib/fal.ts`.

---

## 4) Reference image handling (temporary vs persisted)

### Reference images (temporary working data)

Reference images are handled as **base64 data URIs** in the UI while working.

However, we intentionally **do not persist base64 images** in `localStorage`, because they can exceed browser quota quickly.

Source: `lib/store.ts` implements a “strip large data before saving” strategy:
- `post.referenceImages` (base64) → stripped before save
- `post.imagePrompts[].referenceImages` (base64) → stripped before save

This is why reference images may “disappear” on refresh — by design.

### Generated images (persisted)

Generated images are stored as **URLs** (fal.ai CDN URLs) and are safe to persist:
- very small data footprint (just strings)
- the bytes live on fal.ai’s CDN, not in the browser storage

So we keep:
- `post.generatedImages[]` (URLs, selected flags, metadata)
- `post.generationHistory[]` (prompts + settings + image URLs)

---

## 5) Prompt Helper → Gemini flow (per tab)

### API route

- **Endpoint**: `POST /api/prompt-helper`
- **Server code**: `app/api/prompt-helper/route.ts`

### Request body (client → server)

```json
{
  "userInput": "string",
  "currentPrompt": "string",
  "referenceImages": ["data:image/png;base64,...", "..."]
}
```

### What we send to Gemini

- **Model**: `gemini-2.5-flash`
- **systemInstruction**: `SYSTEM_PROMPT` (defined in `app/api/prompt-helper/route.ts`)
  - enforces Seedream best practices (Figure references, no identity traits)
- **contents.parts**:
  - A context message including:
    - `User request: ...`
    - `Current prompt: ...` (if provided)
    - `Reference images: N image(s) attached.`
  - Then the reference images as inlineData parts
- **generationConfig**:
  - `temperature: 0.7`
  - (no JSON mime type; we want plain text)

### Expected output

Gemini returns **plain text only**: the optimized Seedream prompt.

The route returns:

```json
{ "prompt": "string" }
```

We also strip accidental markdown artifacts (code fences/headers) server-side.

---

## 6) Iterate & Download (gallery actions)

### Iterate

“Iterate” is intended to support rapid improvement loops:
- keep the generated image in the gallery
- add it to the active prompt’s **reference images**
- user generates again using this newly added reference

### Download

“Download” fetches the fal.ai CDN image and triggers a browser download.

---

## 7) Environment variables

Configured in `.env.local`:

- `GEMINI_API_KEY`: required for `/api/brainstorm` and `/api/prompt-helper`
- `FAL_KEY`: required for `/api/generate`

---

## 8) Debugging checklist

- **Gemini errors**
  - check `GEMINI_API_KEY`
  - check model name `gemini-2.5-flash`
  - verify request body contains either `idea` or at least one image

- **fal.ai errors**
  - check `FAL_KEY`
  - ensure `imageUrls` is non-empty
  - confirm the endpoint used is `fal-ai/bytedance/seedream/v4.5/edit`

- **“My reference images disappeared”**
  - expected after refresh; base64 references are stripped from `localStorage` to avoid quota issues

