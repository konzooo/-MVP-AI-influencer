"use client";

import { useState } from "react";
import { PostPlan } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Send, CalendarIcon, Clock, AlertCircle } from "lucide-react";
import { InstagramPreview } from "./InstagramPreview";
import { PublishProgress } from "./PublishProgress";
import { AccountStatus } from "./AccountStatus";
import { useInstagramAccount } from "@/hooks/use-instagram-account";
import { canPublish, recordPublish } from "@/lib/instagram-rate-limit";
import { toast } from "sonner";

interface PublishingPanelProps {
  post: PostPlan;
  onUpdate: (post: PostPlan) => void;
}

export function PublishingPanel({ post, onUpdate }: PublishingPanelProps) {
  const { account, loading, connect, disconnect, refreshToken } =
    useInstagramAccount();
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(undefined);
  const [scheduledTime, setScheduledTime] = useState("12:00");
  const [isPublishing, setIsPublishing] = useState(false);

  const selectedImages = post.generatedImages.filter((i) => i.selected);
  const hasImages = selectedImages.length > 0;
  const hasCaption = post.caption.trim().length > 0;
  const isConnected = account.connected;
  const isReadyToPublish = post.status === "ready";
  const hasBeenPublished =
    post.status === "posted" || post.status === "scheduled";

  // Validation
  const fullCaption =
    post.caption +
    (post.hashtags.length
      ? "\n\n" +
        post.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")
      : "");
  const captionTooLong = fullCaption.length > 2200;
  const tooManyHashtags = post.hashtags.length > 30;
  const rateLimitReached = !canPublish();

  const canPublishNow =
    isReadyToPublish &&
    hasImages &&
    hasCaption &&
    isConnected &&
    !captionTooLong &&
    !tooManyHashtags &&
    !rateLimitReached &&
    !isPublishing;

  const getScheduledTimestamp = (): number | undefined => {
    if (!isScheduled || !scheduledDate) return undefined;
    const [hours, minutes] = scheduledTime.split(":").map(Number);
    const dt = new Date(scheduledDate);
    dt.setHours(hours, minutes, 0, 0);
    return Math.floor(dt.getTime() / 1000);
  };

  const handlePublish = async () => {
    if (!canPublishNow) return;

    const scheduledTimestamp = getScheduledTimestamp();

    // Validate scheduled time
    if (isScheduled) {
      if (!scheduledTimestamp) {
        toast.error("Please select a date and time for scheduling.");
        return;
      }
      const minTime = Math.floor(Date.now() / 1000) + 10 * 60; // 10 min from now
      const maxTime = Math.floor(Date.now() / 1000) + 75 * 24 * 60 * 60; // 75 days
      if (scheduledTimestamp < minTime) {
        toast.error("Scheduled time must be at least 10 minutes from now.");
        return;
      }
      if (scheduledTimestamp > maxTime) {
        toast.error("Scheduled time must be within 75 days.");
        return;
      }
    }

    setIsPublishing(true);
    onUpdate({
      ...post,
      status: "publishing",
      publishingInfo: { status: "publishing" },
    });

    try {
      const res = await fetch("/api/instagram/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageUrls: selectedImages.map((img) => img.url),
          caption: post.caption,
          hashtags: post.hashtags,
          postType: post.postType,
          scheduledTime: scheduledTimestamp,
        }),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        onUpdate({
          ...post,
          status: "ready",
          publishingInfo: {
            status: "failed",
            error: data.error || "Publishing failed",
          },
        });
        toast.error(data.error || "Publishing failed");
        return;
      }

      if (data.scheduled) {
        onUpdate({
          ...post,
          status: "scheduled",
          publishingInfo: {
            status: "scheduled",
            igPostId: data.igPostId,
            scheduledFor: scheduledDate
              ? new Date(
                  scheduledDate.getFullYear(),
                  scheduledDate.getMonth(),
                  scheduledDate.getDate(),
                  ...scheduledTime.split(":").map(Number)
                ).toISOString()
              : undefined,
          },
        });
        toast.success("Post scheduled successfully!");
      } else {
        recordPublish();
        onUpdate({
          ...post,
          status: "posted",
          publishingInfo: {
            status: "published",
            igPostId: data.igPostId,
            permalink: data.permalink,
            publishedAt: new Date().toISOString(),
          },
        });
        toast.success("Published to Instagram!");
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Network error";
      onUpdate({
        ...post,
        status: "ready",
        publishingInfo: {
          status: "failed",
          error: message,
        },
      });
      toast.error(`Publishing failed: ${message}`);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleRetry = () => {
    onUpdate({
      ...post,
      status: "ready",
      publishingInfo: { status: "idle" },
    });
  };

  return (
    <div className="space-y-5">
      {/* Instagram Preview */}
      <div>
        <h3 className="mb-3 text-xs font-medium text-zinc-400">
          Instagram Preview
        </h3>
        <InstagramPreview post={post} account={account} />
      </div>

      {/* Publishing Progress / Status */}
      <PublishProgress
        post={post}
        isPublishing={isPublishing}
        onRetry={handleRetry}
        onReconnect={connect}
      />

      {/* Publish Controls — only show when ready */}
      {isReadyToPublish && !isPublishing && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
          <h3 className="mb-3 text-xs font-medium text-zinc-400">
            Publish Settings
          </h3>

          {/* Schedule toggle */}
          <div className="flex items-center justify-between rounded-md bg-zinc-900/50 p-3">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-zinc-400" />
              <span className="text-sm text-zinc-300">Schedule for later</span>
            </div>
            <Switch
              checked={isScheduled}
              onCheckedChange={setIsScheduled}
            />
          </div>

          {/* Schedule picker */}
          {isScheduled && (
            <div className="mt-3 space-y-2 rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <label className="text-[10px] font-medium text-zinc-500">
                    Date
                  </label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="mt-1 w-full justify-start border-zinc-700 text-left text-xs font-normal"
                      >
                        <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                        {scheduledDate
                          ? scheduledDate.toLocaleDateString()
                          : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        disabled={(date) => {
                          const today = new Date();
                          today.setHours(0, 0, 0, 0);
                          const maxDate = new Date();
                          maxDate.setDate(maxDate.getDate() + 75);
                          return date < today || date > maxDate;
                        }}
                      />
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="w-28">
                  <label className="text-[10px] font-medium text-zinc-500">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="mt-1 h-9 border-zinc-700 text-xs"
                  />
                </div>
              </div>
              <p className="text-[10px] text-zinc-600">
                Min 10 min from now, max 75 days.{" "}
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </p>
            </div>
          )}

          {/* Validation errors */}
          {(captionTooLong || tooManyHashtags) && (
            <div className="mt-3 space-y-1">
              {captionTooLong && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  Caption + hashtags exceed 2,200 characters (
                  {fullCaption.length})
                </div>
              )}
              {tooManyHashtags && (
                <div className="flex items-center gap-1.5 text-xs text-red-400">
                  <AlertCircle className="h-3 w-3" />
                  Maximum 30 hashtags ({post.hashtags.length})
                </div>
              )}
            </div>
          )}

          {/* Publish button */}
          <Button
            onClick={handlePublish}
            disabled={!canPublishNow}
            className="mt-4 w-full gap-2 bg-violet-600 py-5 text-sm font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
            {isScheduled && scheduledDate
              ? `Schedule for ${scheduledDate.toLocaleDateString()} at ${scheduledTime}`
              : "Publish to Instagram"}
          </Button>

          {/* Disabled reason */}
          {!canPublishNow && !captionTooLong && !tooManyHashtags && (
            <p className="mt-2 text-center text-[10px] text-zinc-600">
              {!isConnected
                ? "Connect your Instagram account to publish"
                : !hasImages
                  ? "Select at least one image"
                  : !hasCaption
                    ? "Add a caption to your post"
                    : rateLimitReached
                      ? "Daily post limit reached (25/25)"
                      : ""}
            </p>
          )}
        </div>
      )}

      {/* Account & Limits (collapsed) */}
      <AccountStatus
        account={account}
        loading={loading}
        onConnect={connect}
        onDisconnect={disconnect}
        onRefreshToken={refreshToken}
      />
    </div>
  );
}
