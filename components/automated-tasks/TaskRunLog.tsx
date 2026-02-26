"use client";

import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

interface TaskRunLogProps {
  log: string[];
  status: "running" | "done" | "error" | "idle";
}

export function TaskRunLog({ log, status }: TaskRunLogProps) {
  if (status === "idle" || log.length === 0) return null;

  return (
    <div className="rounded border border-zinc-800 bg-zinc-950 p-3">
      <div className="mb-2 flex items-center gap-2">
        {status === "running" && (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
            <span className="text-xs font-medium text-violet-400">Running task...</span>
          </>
        )}
        {status === "done" && (
          <>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
            <span className="text-xs font-medium text-emerald-400">Task complete</span>
          </>
        )}
        {status === "error" && (
          <>
            <XCircle className="h-3.5 w-3.5 text-red-400" />
            <span className="text-xs font-medium text-red-400">Task failed</span>
          </>
        )}
      </div>
      <div className="space-y-0.5 font-mono text-[11px]">
        {log.map((line, idx) => {
          const isError = line.startsWith("ERROR") || line.startsWith("ABORT") || line.startsWith("EXCEPTION");
          const isWarning = line.startsWith("WARNING");
          const isDone = line.includes("complete") || line.includes("posted") || line.includes("saved");
          return (
            <div
              key={idx}
              className={
                isError
                  ? "text-red-400"
                  : isWarning
                    ? "text-yellow-400"
                    : isDone
                      ? "text-emerald-400"
                      : "text-zinc-500"
              }
            >
              {isError ? "✗ " : isWarning ? "⚠ " : "› "}
              {line}
            </div>
          );
        })}
        {status === "running" && (
          <div className="text-zinc-600 animate-pulse">›</div>
        )}
      </div>
    </div>
  );
}
