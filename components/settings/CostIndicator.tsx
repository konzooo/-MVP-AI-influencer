"use client";

import { useState, useEffect } from "react";
import { getDailySpend } from "@/lib/cost-tracker";
import { useSettings } from "@/hooks/use-settings";

interface CostIndicatorProps {
  onClick?: () => void;
}

export function CostIndicator({ onClick }: CostIndicatorProps) {
  const [dailySpend, setDailySpend] = useState(0);
  const { costSettings: settings } = useSettings();

  useEffect(() => {
    const update = () => setDailySpend(getDailySpend());
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

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
