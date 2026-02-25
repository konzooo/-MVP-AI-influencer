/**
 * Character reference selection strategy for automated tasks
 *
 * For from_scratch and copy_post inspiration items, Seedream requires a character
 * reference image. This module intelligently selects from the Reference Library
 * based on the post context.
 */

import { ReferenceImage } from "./types";

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

/**
 * Select the best character reference from the library for the given context
 *
 * Strategy:
 * 1. Score all references
 * 2. Among highest scorers (within 1 point), pick randomly to avoid staleness
 * 3. If all scores are 0, pick randomly from entire library
 * 4. If library is empty, return null
 */
export function selectCharacterReference(
  references: ReferenceImage[],
  context: ReferenceMatchContext
): ReferenceImage | null {
  if (references.length === 0) return null;

  const scored = references.map((ref) => ({
    ref,
    score: scoreReference(ref, context),
  }));

  scored.sort((a, b) => b.score - a.score);

  const maxScore = scored[0].score;

  // If all scores are 0, pick randomly from entire library
  if (maxScore === 0) {
    return references[Math.floor(Math.random() * references.length)];
  }

  // Among top scorers (within 1 point of max), pick randomly
  const topTier = scored.filter((s) => s.score >= maxScore - 1);
  return topTier[Math.floor(Math.random() * topTier.length)].ref;
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
