"use client";

import { useState } from "react";
import { PostPlan, GeneratedImage } from "@/lib/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Send, Bookmark, ChevronLeft, ChevronRight } from "lucide-react";
import type { InstagramAccount } from "@/lib/instagram";

interface InstagramPreviewProps {
  post: PostPlan;
  account: InstagramAccount;
}

export function InstagramPreview({ post, account }: InstagramPreviewProps) {
  const selectedImages = post.generatedImages.filter((i) => i.selected);
  const isStory = post.postType === "story";

  if (isStory) {
    return <StoryPreview post={post} account={account} selectedImages={selectedImages} />;
  }

  return <FeedPreview post={post} account={account} selectedImages={selectedImages} />;
}

// ─── Feed Post Preview ──────────────────────────────────────────────────────

function FeedPreview({
  post,
  account,
  selectedImages,
}: {
  post: PostPlan;
  account: InstagramAccount;
  selectedImages: GeneratedImage[];
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const isCarousel = selectedImages.length > 1;
  const currentImage = selectedImages[currentIndex];

  const username = account.username || "your_account";
  const fullCaption = buildPreviewCaption(post.caption, post.hashtags);

  return (
    <div className="mx-auto w-full max-w-[375px]">
      <div className="overflow-hidden rounded-xl border border-zinc-700 bg-black">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-2.5">
          <Avatar className="h-8 w-8">
            <AvatarImage src={account.profilePictureUrl} />
            <AvatarFallback className="bg-zinc-800 text-xs">
              {username[0]?.toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm font-semibold text-white">{username}</span>
        </div>

        {/* Image */}
        <div className="relative aspect-square bg-zinc-900">
          {currentImage ? (
            <img
              src={currentImage.url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center text-zinc-600">
              <span className="text-xs">No images selected</span>
            </div>
          )}

          {/* Carousel navigation */}
          {isCarousel && (
            <>
              {currentIndex > 0 && (
                <button
                  onClick={() => setCurrentIndex((i) => i - 1)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 transition-colors hover:bg-black/70"
                >
                  <ChevronLeft className="h-4 w-4 text-white" />
                </button>
              )}
              {currentIndex < selectedImages.length - 1 && (
                <button
                  onClick={() => setCurrentIndex((i) => i + 1)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1 transition-colors hover:bg-black/70"
                >
                  <ChevronRight className="h-4 w-4 text-white" />
                </button>
              )}

              {/* Slide counter */}
              <div className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                {currentIndex + 1}/{selectedImages.length}
              </div>
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Heart className="h-5 w-5 text-white" />
              <MessageCircle className="h-5 w-5 text-white" />
              <Send className="h-5 w-5 text-white" />
            </div>
            <Bookmark className="h-5 w-5 text-white" />
          </div>

          {/* Carousel dots */}
          {isCarousel && (
            <div className="mt-2 flex justify-center gap-1">
              {selectedImages.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full transition-colors ${
                    i === currentIndex ? "bg-blue-500" : "bg-zinc-600"
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        {/* Caption */}
        {fullCaption && (
          <div className="px-3 pb-3">
            <CaptionPreview username={username} caption={fullCaption} />
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Story Preview ──────────────────────────────────────────────────────────

function StoryPreview({
  account,
  selectedImages,
}: {
  post: PostPlan;
  account: InstagramAccount;
  selectedImages: GeneratedImage[];
}) {
  const username = account.username || "your_account";
  const image = selectedImages[0];

  return (
    <div className="mx-auto w-full max-w-[280px]">
      <div className="overflow-hidden rounded-2xl border border-zinc-700 bg-black">
        {/* Story aspect ratio (9:16) */}
        <div className="relative" style={{ aspectRatio: "9/16" }}>
          {image ? (
            <img
              src={image.url}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-zinc-900 text-zinc-600">
              <span className="text-xs">No image selected</span>
            </div>
          )}

          {/* Story header overlay */}
          <div className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent p-3 pt-4">
            {/* Progress bar */}
            <div className="mb-3 h-0.5 rounded-full bg-white/30">
              <div className="h-full w-full rounded-full bg-white" />
            </div>
            <div className="flex items-center gap-2">
              <Avatar className="h-7 w-7 ring-2 ring-white/30">
                <AvatarImage src={account.profilePictureUrl} />
                <AvatarFallback className="bg-zinc-800 text-[8px]">
                  {username[0]?.toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs font-medium text-white">{username}</span>
              <span className="text-[10px] text-white/60">Just now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Caption Preview ────────────────────────────────────────────────────────

function CaptionPreview({
  username,
  caption,
}: {
  username: string;
  caption: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const maxLength = 120;
  const shouldTruncate = caption.length > maxLength;
  const displayCaption = expanded || !shouldTruncate
    ? caption
    : caption.slice(0, maxLength);

  // Split caption text from hashtags for coloring
  const parts = displayCaption.split(/(#\w+)/g);

  return (
    <p className="text-xs leading-relaxed text-white">
      <span className="font-semibold">{username}</span>{" "}
      {parts.map((part, i) =>
        part.startsWith("#") ? (
          <span key={i} className="text-blue-400">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
      {shouldTruncate && !expanded && (
        <button
          onClick={() => setExpanded(true)}
          className="ml-1 text-zinc-500"
        >
          ...more
        </button>
      )}
    </p>
  );
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildPreviewCaption(caption: string, hashtags: string[]): string {
  const hashtagStr = hashtags
    .map((t) => `#${t.replace(/^#/, "")}`)
    .join(" ");
  if (!hashtagStr) return caption;
  return `${caption}\n\n${hashtagStr}`;
}
