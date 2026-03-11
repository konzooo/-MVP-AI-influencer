import { getConvexClient } from "./convex-client";
import { api } from "@/convex/_generated/api";

const COST_LOG_KEY = "ai-influencer-cost-log";
const COST_SETTINGS_KEY = "ai-influencer-cost-settings";
const LLM_LOG_KEY = "ai-influencer-llm-log";

const COST_PER_GENERATION = 0.04; // USD, roughly equivalent to EUR for MVP

// ─── Types ───────────────────────────────────────────────────────────────

export type LLMProvider = "gemini" | "claude";
export type LLMCallType = "brainstorm" | "caption_helper" | "prompt_helper" | "expand_carousel" | "analyze_images";

export interface CostEntry {
  id: string;
  timestamp: string;
  cost: number;
  type: "generation";
}

export interface LLMEntry {
  id: string;
  timestamp: string;
  provider: LLMProvider;
  callType: LLMCallType;
  cost: number; // 0 for free providers like Gemini
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export interface LLMUsageMetadata {
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
}

export interface CostSettings {
  dailyWarningLimit: number;
  dailyStopLimit: number;
  geminiDailyLimit: number;
}

export const GEMINI_RPD_TIME_ZONE = "America/Los_Angeles";
const DEFAULT_GEMINI_DAILY_LIMIT = 20;

const DEFAULT_SETTINGS: CostSettings = {
  dailyWarningLimit: 1.0,
  dailyStopLimit: 5.0,
  geminiDailyLimit: DEFAULT_GEMINI_DAILY_LIMIT,
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

// ─── Image Generation Cost Log ───────────────────────────────────────────

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

/** Record a generation call. Prunes entries older than 30 days. Also writes to Convex. */
export function recordGeneration(cost: number = COST_PER_GENERATION): void {
  const timestamp = new Date().toISOString();

  // localStorage (synchronous, for fast reads)
  const entries = loadLog();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pruned = entries.filter(
    (e) => new Date(e.timestamp) > thirtyDaysAgo
  );

  pruned.push({
    id: crypto.randomUUID(),
    timestamp,
    cost,
    type: "generation",
  });

  saveLog(pruned);

  // Convex (fire-and-forget, for persistence)
  try {
    const client = getConvexClient();
    client.mutation(api.costLog.record, {
      entryType: "generation",
      timestamp,
      cost,
    });
  } catch {
    // Silently ignore — localStorage is the primary source for now
  }
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

// ─── LLM Usage Log ──────────────────────────────────────────────────────

function loadLLMLog(): LLMEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LLM_LOG_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveLLMLog(entries: LLMEntry[]): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(LLM_LOG_KEY, JSON.stringify(entries));
}

function parseNumericHeader(value: string | null): number | undefined {
  if (!value) return undefined;

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function getDateKeyInTimeZone(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function getEntriesForCurrentDay<T extends { timestamp: string }>(
  entries: T[],
  timeZone?: string
): T[] {
  if (!timeZone) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return entries.filter((entry) => new Date(entry.timestamp) >= today);
  }

  const todayKey = getDateKeyInTimeZone(new Date(), timeZone);
  return entries.filter(
    (entry) => getDateKeyInTimeZone(new Date(entry.timestamp), timeZone) === todayKey
  );
}

/** Record an LLM API call. Prunes entries older than 30 days. Also writes to Convex. */
export function recordLLMCall(
  provider: LLMProvider,
  callType: LLMCallType,
  cost: number = 0,
  usage?: LLMUsageMetadata
): void {
  const timestamp = new Date().toISOString();
  const safeCost = Number.isFinite(cost) ? cost : 0;

  // localStorage (synchronous, for fast reads)
  const entries = loadLLMLog();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pruned = entries.filter(
    (e) => new Date(e.timestamp) > thirtyDaysAgo
  );

  pruned.push({
    id: crypto.randomUUID(),
    timestamp,
    provider,
    callType,
    cost: safeCost,
    inputTokens: usage?.inputTokens,
    outputTokens: usage?.outputTokens,
    model: usage?.model,
  });

  saveLLMLog(pruned);

  // Convex (fire-and-forget, for persistence)
  try {
    const client = getConvexClient();
    client.mutation(api.costLog.record, {
      entryType: "llm",
      timestamp,
      cost: safeCost,
      provider,
      callType,
      inputTokens: usage?.inputTokens,
      outputTokens: usage?.outputTokens,
      model: usage?.model,
    });
  } catch {
    // Silently ignore
  }
}

export function getLLMUsageFromHeaders(headers: Headers): LLMUsageMetadata & { cost: number } {
  return {
    cost: parseNumericHeader(headers.get("x-ai-cost-usd")) ?? 0,
    inputTokens: parseNumericHeader(headers.get("x-ai-input-tokens")),
    outputTokens: parseNumericHeader(headers.get("x-ai-output-tokens")),
    model: headers.get("x-ai-model") ?? undefined,
  };
}

/** Get daily LLM call count by provider. */
export function getDailyLLMCalls(
  provider?: LLMProvider,
  options?: { timeZone?: string }
): LLMEntry[] {
  return getEntriesForCurrentDay(loadLLMLog(), options?.timeZone).filter(
    (entry) => !provider || entry.provider === provider
  );
}

/** Get Gemini call count for the current Pacific day, matching Google's RPD reset. */
export function getGeminiRpdCount(): number {
  return getDailyLLMCalls("gemini", { timeZone: GEMINI_RPD_TIME_ZONE }).length;
}

/** Get Gemini usage stats: count and limit. */
export function getGeminiUsage(): { count: number; limit: number; percentage: number } {
  const settings = getCostSettings();
  const count = getGeminiRpdCount();
  const limit = Math.max(settings.geminiDailyLimit, 1);

  return {
    count,
    limit,
    percentage: Math.min((count / limit) * 100, 100),
  };
}

/** Get Claude daily spend from LLM calls. */
export function getClaudeDailySpend(): number {
  return getDailyLLMCalls("claude").reduce((sum, e) => sum + e.cost, 0);
}

/** Get weekly LLM spend by provider. */
export function getWeeklyLLMSpend(provider?: LLMProvider): number {
  const entries = loadLLMLog();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  return entries
    .filter((e) => new Date(e.timestamp) >= weekAgo && (!provider || e.provider === provider))
    .reduce((sum, e) => sum + e.cost, 0);
}
