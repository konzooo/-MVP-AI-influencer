/**
 * AI Guides client utilities.
 * The backend source of truth is in Convex (convex/aiGuides.ts).
 * Use useQuery(api.aiGuides.get) in components for reactive updates.
 */

export interface AIGuides {
  captionStyle: string;
  promptStyle: string;
}
