"use client";

import { PostPlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  ExternalLink,
  Loader2,
  AlertCircle,
  Clock,
  RotateCcw,
  Instagram,
} from "lucide-react";

interface PublishProgressProps {
  post: PostPlan;
  isPublishing: boolean;
  onRetry: () => void;
  onReconnect: () => void;
}

export function PublishProgress({
  post,
  isPublishing,
  onRetry,
  onReconnect,
}: PublishProgressProps) {
  const status = post.status;
  const publishingInfo = post.publishingInfo;

  // Publishing in progress
  if (status === "publishing" || isPublishing) {
    return (
      <div className="rounded-lg border border-violet-800/50 bg-violet-950/20 p-4">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
          <div>
            <p className="text-sm font-medium text-violet-300">
              Publishing to Instagram...
            </p>
            <p className="mt-0.5 text-xs text-violet-400/70">
              Processing images and creating your post. This may take a few seconds.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Published successfully
  if (status === "posted" && publishingInfo?.status === "published") {
    return (
      <div className="rounded-lg border border-emerald-800/50 bg-emerald-950/20 p-4">
        <div className="flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-emerald-300">
              Published successfully!
            </p>
            {publishingInfo.publishedAt && (
              <p className="mt-0.5 text-xs text-emerald-400/70">
                Posted on{" "}
                {new Date(publishingInfo.publishedAt).toLocaleString()}
              </p>
            )}
          </div>
        </div>

        {publishingInfo.permalink && (
          <a
            href={publishingInfo.permalink}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-emerald-900/30 px-3 py-1.5 text-xs text-emerald-300 transition-colors hover:bg-emerald-900/50"
          >
            <ExternalLink className="h-3 w-3" />
            View on Instagram
          </a>
        )}
      </div>
    );
  }

  // Scheduled
  if (status === "scheduled" && publishingInfo?.scheduledFor) {
    return (
      <div className="rounded-lg border border-blue-800/50 bg-blue-950/20 p-4">
        <div className="flex items-center gap-3">
          <Clock className="h-5 w-5 text-blue-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-blue-300">
              Scheduled for publishing
            </p>
            <p className="mt-0.5 text-xs text-blue-400/70">
              Will be published on{" "}
              {new Date(publishingInfo.scheduledFor).toLocaleString()}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Failed
  if (publishingInfo?.status === "failed" && publishingInfo.error) {
    const isAuthError =
      publishingInfo.error.includes("token") ||
      publishingInfo.error.includes("Not connected") ||
      publishingInfo.error.includes("permission");

    return (
      <div className="rounded-lg border border-red-800/50 bg-red-950/20 p-4">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-red-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-300">Publishing failed</p>
            <p className="mt-0.5 text-xs text-red-400/70">
              {publishingInfo.error}
            </p>
          </div>
        </div>

        <div className="mt-3 flex gap-2">
          {isAuthError ? (
            <Button
              size="sm"
              onClick={onReconnect}
              className="h-7 gap-1.5 bg-violet-600 px-3 text-xs hover:bg-violet-700"
            >
              <Instagram className="h-3 w-3" />
              Reconnect Account
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={onRetry}
              className="h-7 gap-1.5 bg-violet-600 px-3 text-xs hover:bg-violet-700"
            >
              <RotateCcw className="h-3 w-3" />
              Retry
            </Button>
          )}
        </div>
      </div>
    );
  }

  // No progress to show (ready state — handled by PublishingPanel directly)
  return null;
}
