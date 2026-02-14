const COST_LOG_KEY = "ai-influencer-cost-log";
const COST_SETTINGS_KEY = "ai-influencer-cost-settings";

const COST_PER_GENERATION = 0.04; // USD, roughly equivalent to EUR for MVP

export interface CostEntry {
  id: string;
  timestamp: string;
  cost: number;
  type: "generation";
}

export interface CostSettings {
  dailyWarningLimit: number;
  dailyStopLimit: number;
}

const DEFAULT_SETTINGS: CostSettings = {
  dailyWarningLimit: 1.0,
  dailyStopLimit: 5.0,
};

// ─── Settings ─────────────────────────────────────────────────────────────

export function getCostSettings(): CostSettings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = localStorage.getItem(COST_SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveCostSettings(settings: CostSettings): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COST_SETTINGS_KEY, JSON.stringify(settings));
}

// ─── Cost Log ─────────────────────────────────────────────────────────────

function loadLog(): CostEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(COST_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLog(entries: CostEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COST_LOG_KEY, JSON.stringify(entries));
}

/** Record a generation call. Prunes entries older than 30 days. */
export function recordGeneration(cost: number = COST_PER_GENERATION): void {
  const entries = loadLog();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pruned = entries.filter(
    (e) => new Date(e.timestamp) > thirtyDaysAgo
  );

  pruned.push({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    cost,
    type: "generation",
  });

  saveLog(pruned);
}

/** Sum of costs for today (local timezone). */
export function getDailySpend(): number {
  const entries = loadLog();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return entries
    .filter((e) => new Date(e.timestamp) >= today)
    .reduce((sum, e) => sum + e.cost, 0);
}

/** Sum of costs for the last 7 days. */
export function getWeeklySpend(): number {
  const entries = loadLog();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  return entries
    .filter((e) => new Date(e.timestamp) >= weekAgo)
    .reduce((sum, e) => sum + e.cost, 0);
}

/** Get today's generation count. */
export function getDailyGenerationCount(): number {
  const entries = loadLog();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return entries.filter((e) => new Date(e.timestamp) >= today).length;
}

/** Check if generation is allowed based on daily limits. */
export function checkDailyLimit(): {
  allowed: boolean;
  warning: boolean;
  dailySpend: number;
  dailyWarningLimit: number;
  dailyStopLimit: number;
} {
  const settings = getCostSettings();
  const dailySpend = getDailySpend();

  return {
    allowed: dailySpend < settings.dailyStopLimit,
    warning: dailySpend >= settings.dailyWarningLimit,
    dailySpend,
    dailyWarningLimit: settings.dailyWarningLimit,
    dailyStopLimit: settings.dailyStopLimit,
  };
}
