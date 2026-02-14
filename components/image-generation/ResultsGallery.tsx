"use client";

import { useState } from "react";
import { toast } from "sonner";
import { GeneratedImage, GenerationAttempt } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  ArrowRightCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  History,
  X,
  ZoomIn,
} from "lucide-react";

interface ResultsGalleryProps {
  images: GeneratedImage[];
  history: GenerationAttempt[];
  onToggleSelect: (imageId: string) => void;
  onIterate: (image: GeneratedImage) => void;
  onConfirmImages: () => void;
  hasSelection: boolean;
}

export function ResultsGallery({
  images,
  history,
  onToggleSelect,
  onIterate,
  onConfirmImages,
  hasSelection,
}: ResultsGalleryProps) {
  const handleDownload = async (image: GeneratedImage) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `generated-${image.id}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Download failed:", error);
      toast.error("Download failed — please try again");
    }
  };
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  if (images.length === 0 && history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-zinc-800 py-12 text-center">
        <p className="text-sm text-zinc-500">No images generated yet</p>
        <p className="mt-1 text-xs text-zinc-600">
          Configure your prompt and references above, then click Generate.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current results */}
      {images.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-medium text-zinc-400">
              Generated Images ({images.length})
            </h4>
            {hasSelection && (
              <Button
                size="sm"
                onClick={onConfirmImages}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Check className="mr-1 h-3 w-3" />
                Confirm Images
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((img) => (
              <div
                key={img.id}
                className="group relative overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
              >
                <img
                  src={img.url}
                  alt=""
                  className="aspect-square w-full object-cover"
                />

                {/* Overlay */}
                <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 transition-all group-hover:bg-black/50">
                  {/* Top: select checkbox */}
                  <div className="flex items-start justify-between">
                    <div
                      className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={() => onToggleSelect(img.id)}
                    >
                      <Checkbox
                        checked={img.selected}
                        className="h-3.5 w-3.5"
                      />
                      <span className="text-[10px] text-zinc-300">Select</span>
                    </div>
                    {img.selected && (
                      <Badge className="bg-emerald-600 text-[9px] text-white">
                        Selected
                      </Badge>
                    )}
                  </div>

                  {/* Bottom: actions */}
                  <div className="flex items-center justify-between opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => setLightboxUrl(img.url)}
                      className="flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[10px] text-zinc-300 hover:bg-black/80"
                    >
                      <ZoomIn className="h-3 w-3" />
                      View
                    </button>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDownload(img)}
                        className="flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[10px] text-zinc-300 hover:bg-black/80"
                      >
                        <Download className="h-3 w-3" />
                        Download
                      </button>
                      <button
                        onClick={() => onIterate(img)}
                        className="flex items-center gap-1 rounded bg-black/60 px-2 py-1 text-[10px] text-zinc-300 hover:bg-black/80"
                      >
                        <ArrowRightCircle className="h-3 w-3" />
                        Iterate
                      </button>
                    </div>
                  </div>
                </div>

                {/* Seed badge */}
                {img.seed && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(String(img.seed));
                    }}
                    className="absolute bottom-0 left-0 right-0 bg-black/70 px-2 py-1 text-[9px] text-zinc-400 opacity-0 transition-opacity hover:bg-black/90 hover:text-violet-300 group-hover:opacity-100"
                    title="Click to copy seed"
                  >
                    Seed: {img.seed}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generation history */}
      {history.length > 0 && (
        <Collapsible open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
          <CollapsibleTrigger className="flex items-center gap-1.5 text-xs text-zinc-500 transition-colors hover:text-zinc-300">
            {isHistoryOpen ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            <History className="h-3 w-3" />
            Generation History ({history.length} attempts)
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3 space-y-3">
            {history.map((attempt) => (
              <div
                key={attempt.id}
                className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] text-zinc-500">
                    {new Date(attempt.createdAt).toLocaleString()}
                  </span>
                  <Badge
                    variant="outline"
                    className="border-zinc-700 text-[9px] text-zinc-400"
                  >
                    {attempt.settings.imageSize} · {attempt.images.length} images
                  </Badge>
                </div>
                <p className="mb-2 text-[10px] font-mono text-zinc-500 line-clamp-2">
                  {attempt.prompt}
                </p>
                <div className="flex gap-2 overflow-x-auto">
                  {attempt.images.map((img) => (
                    <img
                      key={img.id}
                      src={img.url}
                      alt=""
                      className="h-16 w-16 shrink-0 cursor-pointer rounded object-cover transition-opacity hover:opacity-80"
                      onClick={() => setLightboxUrl(img.url)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Lightbox */}
      <Dialog
        open={!!lightboxUrl}
        onOpenChange={() => setLightboxUrl(null)}
      >
        <DialogContent className="max-w-3xl border-zinc-800 bg-zinc-950 p-1">
          {lightboxUrl && (
            <img
              src={lightboxUrl}
              alt="Generated image"
              className="w-full rounded"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
