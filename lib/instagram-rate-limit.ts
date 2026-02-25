const RATE_LIMIT_KEY = "ai-influencer-ig-rate-limit";
const MAX_POSTS_PER_24H = 25;

interface RateLimitEntry {
  id: string;
  timestamp: string;
}

function loadEntries(): RateLimitEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(RATE_LIMIT_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveEntries(entries: RateLimitEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(entries));
}

/** Record a publish. Prunes entries older than 24 hours. */
export function recordPublish(): void {
  const entries = loadEntries();
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  const pruned = entries.filter((e) => new Date(e.timestamp) > oneDayAgo);

  pruned.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  });

  saveEntries(pruned);
}

/** Get number of publishes in last 24 hours. */
export function getPublishCountLast24h(): number {
  const entries = loadEntries();
  const oneDayAgo = new Date();
  oneDayAgo.setHours(oneDayAgo.getHours() - 24);

  return entries.filter((e) => new Date(e.timestamp) > oneDayAgo).length;
}

/** Check if publishing is allowed (under 25 posts in 24h). */
export function canPublish(): boolean {
  return getPublishCountLast24h() < MAX_POSTS_PER_24H;
}

/** Get remaining publish allowance. */
export function getRemainingPublishes(): number {
  return Math.max(0, MAX_POSTS_PER_24H - getPublishCountLast24h());
}
