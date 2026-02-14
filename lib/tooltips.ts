export const tooltips = {
  // Image Generation settings
  imageSize:
    "Choose based on where this will be posted. Square for Instagram feed posts, 4:3 portrait for Stories/Reels, 16:9 landscape for carousels with text overlays.",
  seed: "A number that makes generation reproducible. Found a result you love? Copy the seed and use it again with small prompt tweaks to get variations. Leave empty for a random result each time.",
  numVariations:
    "Generate multiple versions at once so you can compare and pick the best one. Each variation counts as one image generation ($0.04).",
  maxImages:
    "Seedream can sometimes return multiple images per generation call. Useful for exploring different interpretations of the same prompt.",
  safetyChecker:
    "Filters out potentially inappropriate content. Keep enabled unless you're getting false positives on normal content.",


  // Creative Lab — Creation modes
  fromScratch:
    "Describe your post idea in your own words. Add optional inspiration images. The AI will build a complete post plan from your description.",
  copyPost:
    "Upload screenshots of existing Instagram posts you want to recreate with your character. The AI will analyze every detail — pose, environment, lighting, clothing — and create a prompt that reproduces it all, but with your character's identity.",

  // Creative Lab — Post types
  postType:
    "Choose the format before generating. This affects the prompt structure and can't be changed after the plan is created.",
  postTypeSingleImage: "A single photo in the feed. Standard square or portrait format.",
  postTypeCarousel:
    "Multiple images you swipe through. Great for outfit series, before/after, or storytelling.",
  postTypeReelCover:
    "The thumbnail image for a video reel. Typically eye-catching with a clear subject.",
  postTypeStory:
    "A vertical full-screen image or short clip. Disappears after 24h. Good for casual/behind-the-scenes content.",

  // Creative Lab — Fields
  caption:
    "The text that appears below your Instagram post. Should be engaging and on-brand for your character.",
  hashtags:
    "Hashtags help your post get discovered. Mix popular ones (#photography) with niche ones (#aiinfluencer) for best reach.",
  imagePrompt:
    "This is the exact text that will be sent to the image generation AI. It describes the scene, pose, and mood — but NOT your character's facial features (those come from the character reference photo).",
  referenceImageAnalysis:
    "The AI's detailed breakdown of what it sees in the source image: pose, environment, lighting, clothing, and the original person's features. This is read-only — it helps you verify the AI understood the image correctly. Identity features shown here are deliberately kept OUT of the generation prompt to avoid conflicts.",

  // Story-specific
  storyTextOverlay:
    "Text that will appear over the story image. Keep it short and impactful.",
  storyLink:
    "URL for the 'link sticker' on the story. Followers can tap to visit this link.",
  storyDuration:
    "How long the story image shows (in seconds). Default is 5 seconds.",
} as const;
