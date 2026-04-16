/**
 * Character reference selection strategy for automated tasks
 *
 * For from_scratch and copy_post inspiration items, Seedream requires a character
 * reference image. This module intelligently selects from the Reference Library
 * based on the post context.
 */

import { ReferenceImage } from "./types";

const FACE_REFERENCE_TAG = "face_reference";

export interface ReferenceMatchContext {
  styleMode?: string;           // e.g. "Beach / Coastal"
  location?: string;            // e.g. "Travel: Southeast Asia"
  indoorOutdoor?: "indoor" | "outdoor";
  timeOfDay?: "day" | "night" | "golden_hour" | "blue_hour";
  keywords?: string[];          // from analysis text, e.g. ["beach", "sunset"]
}

/**
 * Score a reference image based on how well it matches the context
 */
function scoreReference(ref: ReferenceImage, ctx: ReferenceMatchContext): number {
  let score = 0;

  // Style mode matching via tags
  if (ctx.styleMode) {
    const modeLower = ctx.styleMode.toLowerCase();
    if (ref.tags.some((t) => t.toLowerCase().includes(modeLower))) {
      score += 3;
    }
  }

  // Indoor/outdoor matching
  if (ctx.indoorOutdoor && ref.metadata.indoor_outdoor === ctx.indoorOutdoor) {
    score += 2;
  }

  // Time of day matching (golden hour for beach/travel)
  if (ctx.timeOfDay && ref.metadata.time_of_day === ctx.timeOfDay) {
    score += 2;
  }

  // Location keyword matching in summary/tags
  if (ctx.location) {
    const locLower = ctx.location.toLowerCase();
    if (ref.summary.toLowerCase().includes(locLower)) {
      score += 2;
    }
    if (ref.tags.some((t) => t.toLowerCase().includes(locLower))) {
      score += 2;
    }
  }

  // Generic keyword matching from analysis
  if (ctx.keywords && ctx.keywords.length > 0) {
    for (const keyword of ctx.keywords) {
      const kwLower = keyword.toLowerCase();
      if (ref.summary.toLowerCase().includes(kwLower)) {
        score += 1;
      }
      if (ref.tags.some((t) => t.toLowerCase().includes(kwLower))) {
        score += 1;
      }
    }
  }

  return score;
}

export function isFaceReference(ref: ReferenceImage): boolean {
  return ref.tags.some((tag) => tag.toLowerCase() === FACE_REFERENCE_TAG);
}

export function getSelectableCharacterReferences(
  references: ReferenceImage[]
): ReferenceImage[] {
  return references.filter(isFaceReference);
}

function pickPrimaryCharacterReference(
  eligibleReferences: ReferenceImage[],
  context: ReferenceMatchContext
): ReferenceImage | null {
  if (eligibleReferences.length === 0) return null;

  const scored = eligibleReferences.map((ref) => ({
    ref,
    score: scoreReference(ref, context),
  }));

  scored.sort((a, b) => b.score - a.score);

  const maxScore = scored[0].score;

  if (maxScore === 0) {
    return eligibleReferences[Math.floor(Math.random() * eligibleReferences.length)];
  }

  const topTier = scored.filter((s) => s.score >= maxScore - 1);
  return topTier[Math.floor(Math.random() * topTier.length)].ref;
}

function shuffleReferences(references: ReferenceImage[]): ReferenceImage[] {
  const shuffled = [...references];

  for (let index = shuffled.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled;
}

/**
 * Select the best character reference from the library for the given context
 *
 * Strategy:
 * 1. Only consider images tagged as face references
 * 2. Score all eligible references
 * 3. Among highest scorers (within 1 point), pick randomly to avoid staleness
 * 4. If all scores are 0, pick randomly from eligible references
 * 5. If no eligible references exist, return null
 */
export function selectCharacterReference(
  references: ReferenceImage[],
  context: ReferenceMatchContext
): ReferenceImage | null {
  const eligibleReferences = getSelectableCharacterReferences(references);
  return pickPrimaryCharacterReference(eligibleReferences, context);
}

/**
 * Select up to N different character references.
 *
 * Strategy:
 * 1. Pick the primary anchor using the existing context-aware scoring logic
 * 2. Fill the remaining slots with different face-tagged references in random order
 * 3. Keep the primary anchor first so prompt references still map cleanly to Figure 1
 */
export function selectCharacterReferences(
  references: ReferenceImage[],
  context: ReferenceMatchContext,
  count = 3
): ReferenceImage[] {
  const eligibleReferences = getSelectableCharacterReferences(references);
  if (eligibleReferences.length === 0 || count <= 0) return [];

  const primaryReference = pickPrimaryCharacterReference(eligibleReferences, context);
  if (!primaryReference) return [];

  const remainingReferences = shuffleReferences(
    eligibleReferences.filter((ref) => ref.id !== primaryReference.id)
  );

  return [primaryReference, ...remainingReferences].slice(0, count);
}

/**
 * Build context from a style mode name
 * Maps style modes to likely indoor/outdoor and time_of_day values
 * based on common patterns in Alba's style modes
 */
export function buildContextFromStyleMode(styleModeName: string): ReferenceMatchContext {
  const modeLower = styleModeName.toLowerCase();

  const context: ReferenceMatchContext = {
    styleMode: styleModeName,
  };

  // Heuristic mapping based on Alba's style modes
  if (modeLower.includes("beach") || modeLower.includes("coastal")) {
    context.indoorOutdoor = "outdoor";
    context.timeOfDay = "golden_hour";
  } else if (modeLower.includes("travel") || modeLower.includes("international")) {
    context.indoorOutdoor = "outdoor";
    context.timeOfDay = "golden_hour";
  } else if (modeLower.includes("urban") || modeLower.includes("street")) {
    context.indoorOutdoor = "outdoor";
    context.timeOfDay = "day";
  } else if (modeLower.includes("fashion") || modeLower.includes("editorial")) {
    context.indoorOutdoor = "indoor";
    context.timeOfDay = "day";
  } else if (modeLower.includes("gym") || modeLower.includes("workout")) {
    context.indoorOutdoor = "indoor";
    context.timeOfDay = "day";
  }

  return context;
}

/**
 * Build context from keywords extracted from analysis or caption text
 */
export function buildContextFromKeywords(text: string): ReferenceMatchContext {
  const context: ReferenceMatchContext = {
    keywords: [],
  };

  // Simple keyword extraction: split by common delimiters, lowercase
  const words = text.toLowerCase().split(/[\s,;:.—\-]+/);
  const keywords = words.filter(
    (w) => w.length > 3 && !["the", "and", "for", "with", "from", "that"].includes(w)
  );

  context.keywords = keywords.slice(0, 5); // limit to first 5

  // Heuristic indoor/outdoor detection
  const indoorKeywords = ["bedroom", "apartment", "office", "gym", "indoor", "mirror"];
  const outdoorKeywords = ["beach", "outdoor", "park", "street", "coast", "travel"];

  const hasIndoor = indoorKeywords.some((k) => text.toLowerCase().includes(k));
  const hasOutdoor = outdoorKeywords.some((k) => text.toLowerCase().includes(k));

  if (hasOutdoor && !hasIndoor) {
    context.indoorOutdoor = "outdoor";
  } else if (hasIndoor && !hasOutdoor) {
    context.indoorOutdoor = "indoor";
  }

  // Heuristic time_of_day detection
  if (text.toLowerCase().includes("sunset") || text.toLowerCase().includes("golden")) {
    context.timeOfDay = "golden_hour";
  } else if (text.toLowerCase().includes("night")) {
    context.timeOfDay = "night";
  } else if (text.toLowerCase().includes("blue")) {
    context.timeOfDay = "blue_hour";
  }

  return context;
}
