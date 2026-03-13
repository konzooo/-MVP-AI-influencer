"use client";

import { useState } from "react";
import Image from "next/image";
import { InspirationItem, OwnImageInspirationItem, CopyPostInspirationItem, FromScratchInspirationItem } from "@/lib/task-types";
import { ImageIcon, Sparkles, Upload, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

interface InspirationQueueProps {
  items: InspirationItem[];
  onReorder: (items: InspirationItem[]) => void;
  onDelete: (id: string) => void;
}

function itemTypeLabel(item: InspirationItem): string {
  if (item.type === "own_image") return "Own Image";
  if (item.type === "copy_post") return "Copy Post";
  return "From Scratch";
}

function ItemIcon({ type }: { type: InspirationItem["type"] }) {
  if (type === "own_image") return <ImageIcon className="h-3.5 w-3.5 text-emerald-400" />;
  if (type === "copy_post") return <Upload className="h-3.5 w-3.5 text-blue-400" />;
  return <Sparkles className="h-3.5 w-3.5 text-violet-400" />;
}

function itemSummary(item: InspirationItem): string {
  if (item.type === "from_scratch") {
    const fs = item as FromScratchInspirationItem;
    const parts: string[] = [];
    if (fs.preferredStyleMode) parts.push(fs.preferredStyleMode);
    if (fs.preferredLocation) parts.push(fs.preferredLocation);
    return parts.length > 0 ? parts.join(" · ") : "AI picks style & location";
  }
  const img = item as OwnImageInspirationItem | CopyPostInspirationItem;
  return `${img.imageUrls.length} image${img.imageUrls.length !== 1 ? "s" : ""}`;
}

export function InspirationQueue({ items, onReorder, onDelete }: InspirationQueueProps) {
  const [previewItemId, setPreviewItemId] = useState<string | null>(null);
  const [previewIndex, setPreviewIndex] = useState(0);

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const next = [...items];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    onReorder(next);
  };

  const moveDown = (idx: number) => {
    if (idx === items.length - 1) return;
    const next = [...items];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    onReorder(next);
  };

  const previewItem = items.find(
    (item) =>
      item.id === previewItemId &&
      (item.type === "own_image" || item.type === "copy_post")
  ) as OwnImageInspirationItem | CopyPostInspirationItem | undefined;

  const previewImages = previewItem?.imageUrls ?? [];
  const hasMultiplePreviewImages = previewImages.length > 1;

  const openPreview = (item: OwnImageInspirationItem | CopyPostInspirationItem, index = 0) => {
    setPreviewItemId(item.id);
    setPreviewIndex(index);
  };

  if (items.length === 0) {
    return (
      <p className="text-xs text-zinc-600 italic">
        No items. When the task runs, it will fall back to from-scratch generation using your Identity Profile.
      </p>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div
            key={item.id}
            className={`flex items-start gap-3 rounded border p-3 transition-colors ${
              item.status === "used"
                ? "border-zinc-800 bg-zinc-900/30 opacity-60"
                : item.status === "skipped"
                  ? "border-zinc-800 bg-zinc-900/30 opacity-40"
                  : "border-zinc-800 bg-zinc-800/50"
            }`}
          >
            {/* Thumbnail (own_image / copy_post) */}
            {(item.type === "own_image" || item.type === "copy_post") &&
              (item as OwnImageInspirationItem | CopyPostInspirationItem).imageUrls.length > 0 && (
                <button
                  type="button"
                  onClick={() => openPreview(item as OwnImageInspirationItem | CopyPostInspirationItem)}
                  className="group/preview relative h-10 w-10 flex-shrink-0 overflow-hidden rounded focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 focus:ring-offset-zinc-950"
                  aria-label="Open inspiration image preview"
                >
                  <Image
                    src={(item as OwnImageInspirationItem | CopyPostInspirationItem).imageUrls[0]}
                    alt={`${itemTypeLabel(item)} preview`}
                    unoptimized
                    fill
                    sizes="40px"
                    className="object-cover transition-transform group-hover/preview:scale-105"
                  />
                </button>
              )}

            {/* From scratch icon */}
            {item.type === "from_scratch" && (
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded bg-violet-950/30">
                <Sparkles className="h-4 w-4 text-violet-400" />
              </div>
            )}

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <ItemIcon type={item.type} />
                <span className="text-xs font-medium text-zinc-200">{itemTypeLabel(item)}</span>
                <span
                  className={`ml-auto text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    item.status === "pending"
                      ? "bg-blue-950 text-blue-400"
                      : item.status === "used"
                        ? "bg-green-950 text-green-400"
                        : "bg-yellow-950 text-yellow-400"
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <p className="mt-0.5 text-[11px] text-zinc-500 truncate">{itemSummary(item)}</p>
              {item.notes && (
                <p className="mt-0.5 text-[11px] text-zinc-600 truncate italic">&quot;{item.notes}&quot;</p>
              )}
            </div>

            {/* Controls (only for pending items) */}
            {item.status === "pending" && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => moveDown(idx)}
                  disabled={idx === items.length - 1 || items[idx + 1]?.status !== "pending"}
                  className="text-zinc-600 hover:text-zinc-300 disabled:opacity-20"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  className="text-zinc-600 hover:text-red-400"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      <Dialog
        open={previewImages.length > 0}
        onOpenChange={(open) => {
          if (!open) {
            setPreviewItemId(null);
            setPreviewIndex(0);
          }
        }}
      >
        <DialogContent className="max-w-5xl border-zinc-800 bg-zinc-950 p-4 sm:p-6">
          <DialogTitle className="sr-only">Inspiration image preview</DialogTitle>
          {previewImages.length > 0 && (
            <div className="space-y-3">
              <div className="relative flex max-h-[80vh] min-h-[320px] items-center justify-center overflow-hidden rounded-lg bg-black">
                <Image
                  src={previewImages[previewIndex]}
                  alt={`Inspiration preview ${previewIndex + 1}`}
                  unoptimized
                  width={1600}
                  height={1600}
                  sizes="100vw"
                  className="max-h-[80vh] w-auto max-w-full object-contain"
                />

                {hasMultiplePreviewImages && (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIndex((current) =>
                          current === 0 ? previewImages.length - 1 : current - 1
                        )
                      }
                      className="absolute left-3 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                      aria-label="Previous image"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewIndex((current) =>
                          current === previewImages.length - 1 ? 0 : current + 1
                        )
                      }
                      className="absolute right-3 rounded-full bg-black/60 p-2 text-white transition hover:bg-black/80"
                      aria-label="Next image"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </>
                )}
              </div>

              {hasMultiplePreviewImages && (
                <p className="text-center text-xs text-zinc-400">
                  Image {previewIndex + 1} of {previewImages.length}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
