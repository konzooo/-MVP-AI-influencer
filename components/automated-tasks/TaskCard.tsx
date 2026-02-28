import { Card } from "@/components/ui/card";
import { Zap } from "lucide-react";
import { Task } from "@/lib/task-types";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const pendingCount = task.inspirationItems.filter((i) => i.status === "pending").length;

  return (
    <Card className="cursor-pointer border-zinc-800 bg-zinc-900/50 p-4 transition-colors hover:bg-zinc-800/50">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-violet-400" />
            <h3 className="text-lg font-semibold text-zinc-100">{task.name}</h3>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                task.status === "running"
                  ? "bg-emerald-950 text-emerald-400"
                  : task.status === "paused"
                    ? "bg-yellow-950 text-yellow-400"
                    : "bg-zinc-800 text-zinc-400"
              }`}
            >
              {task.status}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded font-medium ${
                task.approvalMode === "manual"
                  ? "bg-violet-950 text-violet-400"
                  : "bg-blue-950 text-blue-400"
              }`}
            >
              {task.approvalMode}
            </span>
          </div>
          <p className="mt-1 text-sm text-zinc-400">
            Every {task.cadence.every} {task.cadence.unit}
            {pendingCount > 0 && ` \u00B7 ${pendingCount} items queued`}
            {task.lastRunAt && ` \u00B7 Last run: ${new Date(task.lastRunAt).toLocaleString()}`}
          </p>
          {task.nextRunAt && (
            <p className="mt-1 text-xs text-zinc-500">
              Next run: {new Date(task.nextRunAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}
