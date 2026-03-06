"use client";

import { PostStatus, PostType, CreationMode } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

export interface DashboardFilterState {
  status: PostStatus | "all";
  creationMode: CreationMode | "all";
  postType: PostType | "all";
  source: "all" | "adhoc" | "task";
  sortBy: "updatedAt" | "createdAt";
}

export const DEFAULT_FILTERS: DashboardFilterState = {
  status: "all",
  creationMode: "all",
  postType: "all",
  source: "all",
  sortBy: "updatedAt",
};

interface DashboardFiltersProps {
  filters: DashboardFilterState;
  onChange: (filters: DashboardFilterState) => void;
}

const STATUS_OPTIONS: { value: PostStatus | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "generating", label: "Generating" },
  { value: "ready", label: "Ready" },
  { value: "posted", label: "Posted" },
  { value: "scheduled", label: "Scheduled" },
];

export function DashboardFilters({
  filters,
  onChange,
}: DashboardFiltersProps) {
  const isDefault =
    filters.status === "all" &&
    filters.creationMode === "all" &&
    filters.postType === "all" &&
    filters.source === "all";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Status filter */}
      <div className="flex gap-0.5 rounded-md bg-zinc-900/50 p-0.5">
        {STATUS_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, status: opt.value })}
            className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
              filters.status === opt.value
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Source filter */}
      <div className="flex gap-0.5 rounded-md bg-zinc-900/50 p-0.5">
        {[
          { value: "all" as const, label: "All Sources" },
          { value: "adhoc" as const, label: "Ad-hoc" },
          { value: "task" as const, label: "Task" },
        ].map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange({ ...filters, source: opt.value })}
            className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
              filters.source === opt.value
                ? "bg-zinc-800 text-zinc-200"
                : "text-zinc-500 hover:text-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex gap-0.5 rounded-md bg-zinc-900/50 p-0.5">
        <button
          onClick={() => onChange({ ...filters, sortBy: "updatedAt" })}
          className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
            filters.sortBy === "updatedAt"
              ? "bg-zinc-800 text-zinc-200"
              : "text-zinc-500 hover:text-zinc-400"
          }`}
        >
          Latest Updated
        </button>
        <button
          onClick={() => onChange({ ...filters, sortBy: "createdAt" })}
          className={`rounded px-2 py-1 text-[10px] font-medium transition-colors ${
            filters.sortBy === "createdAt"
              ? "bg-zinc-800 text-zinc-200"
              : "text-zinc-500 hover:text-zinc-400"
          }`}
        >
          Newest First
        </button>
      </div>

      {/* Reset */}
      {!isDefault && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onChange(DEFAULT_FILTERS)}
          className="h-6 gap-1 text-[10px] text-zinc-500 hover:text-zinc-300"
        >
          <X className="h-2.5 w-2.5" />
          Reset
        </Button>
      )}
    </div>
  );
}
