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
import { Coins, TrendingUp } from "lucide-react";
import {
  getDailySpend,
  getWeeklySpend,
  getDailyGenerationCount,
  type CostSettings,
} from "@/lib/cost-tracker";
import { useSettings } from "@/hooks/use-settings";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { costSettings, saveCostSettings } = useSettings();
  const [settings, setSettings] = useState<CostSettings>(costSettings);
  const [dailySpend, setDailySpend] = useState(0);
  const [weeklySpend, setWeeklySpend] = useState(0);
  const [dailyCount, setDailyCount] = useState(0);

  useEffect(() => {
    if (open) {
      setSettings(costSettings);
      setDailySpend(getDailySpend());
      setWeeklySpend(getWeeklySpend());
      setDailyCount(getDailyGenerationCount());
    }
  }, [open, costSettings]);

  const handleSave = async () => {
    await saveCostSettings(settings);
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
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Coins className="h-5 w-5 text-violet-400" />
            Cost Tracker
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Track spending and set daily generation limits.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Spend overview */}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-zinc-400" />
              <span className="text-xs font-medium text-zinc-400">
                Spend Overview
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

          <Separator className="bg-zinc-800" />

          {/* Limits */}
          <div className="space-y-4">
            <h4 className="text-xs font-medium text-zinc-400">Daily Limits</h4>

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
