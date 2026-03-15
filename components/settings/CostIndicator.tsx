"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useCostSettings } from "@/hooks/use-settings";

interface CostIndicatorProps {
  onClick?: () => void;
}

export function CostIndicator({ onClick }: CostIndicatorProps) {
  const summary = useQuery(api.costLog.getDailySummary);
  const { settings } = useCostSettings();
  const dailySpend = summary?.generationSpend ?? 0;

  const color =
    dailySpend >= settings.dailyStopLimit
      ? "text-red-400"
      : dailySpend >= settings.dailyWarningLimit
        ? "text-amber-400"
        : "text-zinc-500";

  return (
    <button
      onClick={onClick}
      className={`text-[10px] ${color} hover:text-zinc-300 transition-colors`}
      title="Click to open settings"
    >
      €{dailySpend.toFixed(2)} today
    </button>
  );
}
