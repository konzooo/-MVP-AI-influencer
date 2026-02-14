"use client";

import { useState } from "react";
import { PostStatus } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const statusConfig: Record<
  PostStatus,
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "border-zinc-600 bg-zinc-800/50 text-zinc-400",
  },
  approved: {
    label: "Approved",
    className: "border-amber-700 bg-amber-950/50 text-amber-400",
  },
  generating: {
    label: "Generating",
    className: "border-amber-700 bg-amber-950/50 text-amber-400",
  },
  ready: {
    label: "Ready",
    className: "border-blue-700 bg-blue-950/50 text-blue-400",
  },
  posted: {
    label: "Posted",
    className: "border-emerald-700 bg-emerald-950/50 text-emerald-400",
  },
};

const ALL_STATUSES: PostStatus[] = [
  "draft",
  "approved",
  "generating",
  "ready",
  "posted",
];

interface StatusBadgeProps {
  status: PostStatus;
  /** When provided, the badge becomes clickable and allows changing the status. */
  onStatusChange?: (newStatus: PostStatus) => void;
  /** Extra tailwind classes for the badge */
  className?: string;
}

export function StatusBadge({
  status,
  onStatusChange,
  className,
}: StatusBadgeProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<PostStatus | null>(null);
  const config = statusConfig[status];

  if (!onStatusChange) {
    return (
      <Badge
        variant="outline"
        className={cn("text-[9px]", config.className, className)}
      >
        {status === "ready" && (
          <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
        )}
        {config.label}
      </Badge>
    );
  }

  const handleSelect = (newStatus: PostStatus) => {
    if (newStatus === status) return;

    // Changing away from "posted" requires confirmation
    if (status === "posted") {
      setPendingStatus(newStatus);
      setConfirmOpen(true);
      return;
    }

    onStatusChange(newStatus);
  };

  const handleConfirm = () => {
    if (pendingStatus) {
      onStatusChange(pendingStatus);
    }
    setConfirmOpen(false);
    setPendingStatus(null);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            className="focus:outline-none"
            onClick={(e) => e.stopPropagation()}
          >
            <Badge
              variant="outline"
              className={cn(
                "cursor-pointer text-[9px] transition-colors hover:brightness-125",
                config.className,
                className
              )}
            >
              {status === "ready" && (
                <CheckCircle2 className="mr-0.5 h-2.5 w-2.5" />
              )}
              {config.label}
              <ChevronDown className="ml-0.5 h-2.5 w-2.5 opacity-50" />
            </Badge>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="min-w-[120px]"
          onClick={(e) => e.stopPropagation()}
        >
          {ALL_STATUSES.map((s) => {
            const sc = statusConfig[s];
            return (
              <DropdownMenuItem
                key={s}
                onClick={() => handleSelect(s)}
                className={cn(
                  "text-xs",
                  s === status && "font-medium"
                )}
              >
                <span
                  className={cn(
                    "mr-2 h-2 w-2 rounded-full",
                    s === "draft" && "bg-zinc-400",
                    s === "approved" && "bg-amber-400",
                    s === "generating" && "bg-amber-400",
                    s === "ready" && "bg-blue-400",
                    s === "posted" && "bg-emerald-400"
                  )}
                />
                {sc.label}
                {s === status && (
                  <span className="ml-auto text-[10px] text-zinc-500">current</span>
                )}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change status from Posted?</DialogTitle>
            <DialogDescription>
              This post is marked as posted. Are you sure you want to change its
              status to &ldquo;{pendingStatus && statusConfig[pendingStatus].label}&rdquo;?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleConfirm}>
              Change Status
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Read-only helper to get status colors (for use outside the badge, e.g. icons) */
export { statusConfig };
