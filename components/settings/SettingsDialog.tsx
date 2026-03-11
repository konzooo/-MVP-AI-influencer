"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Coins, TrendingUp, Cpu, Image as ImageIcon } from "lucide-react";
import {
  getCostSettings,
  saveCostSettings,
  getDailySpend,
  getWeeklySpend,
  getDailyGenerationCount,
  getDailyLLMCalls,
  getGeminiUsage,
  getClaudeDailySpend,
  getWeeklyLLMSpend,
  type CostSettings,
} from "@/lib/cost-tracker";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [settings, setSettings] = useState<CostSettings>(getCostSettings());
  const [dailySpend, setDailySpend] = useState(0);
  const [weeklySpend, setWeeklySpend] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);
  const [geminiUsage, setGeminiUsage] = useState({ count: 0, limit: 500, percentage: 0 });
  const [claudeDailySpend, setClaudeDailySpend] = useState(0);
  const [claudeWeeklySpend, setClaudeWeeklySpend] = useState(0);
  const [geminiDailyCount, setGeminiDailyCount] = useState(0);
  const [claudeDailyCount, setClaudeDailyCount] = useState(0);

  useEffect(() => {
    if (!open) return;

    const update = () => {
      setSettings(getCostSettings());
      setDailySpend(getDailySpend());
      setWeeklySpend(getWeeklySpend());
      setDailyCount(getDailyGenerationCount());
      setGeminiUsage(getGeminiUsage());
      setClaudeDailySpend(getClaudeDailySpend());
      setClaudeWeeklySpend(getWeeklyLLMSpend("claude"));
      setGeminiDailyCount(getDailyLLMCalls("gemini").length);
      setClaudeDailyCount(getDailyLLMCalls("claude").length);
    };

    update();
    const interval = setInterval(update, 2000);
    return () => clearInterval(interval);
  }, [open]);

  const handleSave = () => {
    saveCostSettings(settings);
    onOpenChange(false);
  };

  const spendColor =
    dailySpend >= settings.dailyStopLimit
      ? "text-red-400"
      : dailySpend >= settings.dailyWarningLimit
        ? "text-amber-400"
        : "text-zinc-100";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-950 max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Coins className="h-5 w-5 text-violet-400" />
            Usage & Cost Tracker
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Track API usage across LLMs and image generation.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ─── LLM Usage Section ─────────────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Cpu className="h-4 w-4 text-blue-400" />
              <span className="text-xs font-medium text-zinc-400">
                LLM Usage
              </span>
            </div>

            {/* Gemini */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-300">Gemini 2.5 Flash</span>
                <Badge className="bg-emerald-950 text-emerald-400 border-emerald-800 text-[10px]">
                  Free
                </Badge>
              </div>
              <div className="flex items-center justify-between text-[10px] text-zinc-500 mb-1.5">
                <span>{geminiUsage.count} / {geminiUsage.limit} requests today</span>
                <span>{geminiUsage.percentage.toFixed(0)}%</span>
              </div>
              <div className="w-full h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    geminiUsage.percentage >= 90
                      ? "bg-red-500"
                      : geminiUsage.percentage >= 70
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                  }`}
                  style={{ width: `${geminiUsage.percentage}%` }}
                />
              </div>
              <p className="text-[10px] text-zinc-600 mt-1">
                {geminiDailyCount} call{geminiDailyCount !== 1 ? "s" : ""} today
              </p>
            </div>

            {/* Claude */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-zinc-300">Claude 3.5 Sonnet</span>
                <Badge className="bg-violet-950 text-violet-400 border-violet-800 text-[10px]">
                  Paid
                </Badge>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-1">
                <div>
                  <p className="text-[10px] text-zinc-500">Today</p>
                  <p className="text-sm font-semibold text-zinc-100">
                    €{claudeDailySpend.toFixed(2)}
                  </p>
                  <p className="text-[10px] text-zinc-600">
                    {claudeDailyCount} call{claudeDailyCount !== 1 ? "s" : ""}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] text-zinc-500">This week</p>
                  <p className="text-sm font-semibold text-zinc-100">
                    €{claudeWeeklySpend.toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ─── Image Generation Section ─────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon className="h-4 w-4 text-amber-400" />
              <span className="text-xs font-medium text-zinc-400">
                Image Generation (FAL.ai)
              </span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-[10px] text-zinc-500">Today</p>
                <p className={`text-lg font-semibold ${spendColor}`}>
                  €{dailySpend.toFixed(2)}
                </p>
                <p className="text-[10px] text-zinc-600">
                  {dailyCount} generation{dailyCount !== 1 ? "s" : ""}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">This week</p>
                <p className="text-lg font-semibold text-zinc-100">
                  €{weeklySpend.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">Status</p>
                {dailySpend >= settings.dailyStopLimit ? (
                  <Badge className="mt-1 bg-red-950 text-red-400 border-red-800">
                    Limit reached
                  </Badge>
                ) : dailySpend >= settings.dailyWarningLimit ? (
                  <Badge className="mt-1 bg-amber-950 text-amber-400 border-amber-800">
                    Warning
                  </Badge>
                ) : (
                  <Badge className="mt-1 bg-emerald-950 text-emerald-400 border-emerald-800">
                    OK
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* ─── Total Overview ────────────────────────────────── */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-400">
                Total Spend
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] text-zinc-500">Today</p>
                <p className="text-lg font-semibold text-zinc-100">
                  €{(dailySpend + claudeDailySpend).toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-zinc-500">This week</p>
                <p className="text-lg font-semibold text-zinc-100">
                  €{(weeklySpend + claudeWeeklySpend).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* Limits */}
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-zinc-400">Image Generation Limits</h4>

            <div className="space-y-2">
              <Label className="text-xs text-zinc-500">
                Warning at (€/day)
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={settings.dailyWarningLimit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dailyWarningLimit: parseFloat(e.target.value) || 0,
                  })
                }
                className="border-zinc-800 bg-zinc-900 text-sm text-zinc-100"
              />
              <p className="text-[10px] text-zinc-600">
                Shows a warning toast before each generation when reached
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-zinc-500">
                Stop at (€/day)
              </Label>
              <Input
                type="number"
                step="0.5"
                min="0"
                value={settings.dailyStopLimit}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    dailyStopLimit: parseFloat(e.target.value) || 0,
                  })
                }
                className="border-zinc-800 bg-zinc-900 text-sm text-zinc-100"
              />
              <p className="text-[10px] text-zinc-600">
                Blocks generation entirely when reached
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleSave}
              className="flex-1 bg-violet-600 text-white hover:bg-violet-700"
            >
              Save Settings
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
