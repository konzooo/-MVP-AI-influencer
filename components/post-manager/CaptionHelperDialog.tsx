"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Sparkles, Copy, Check, RotateCcw } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface CaptionHelperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCaption: string;
  imageUrls: string[];
  onApplyCaption: (caption: string) => void;
}

export function CaptionHelperDialog({
  open,
  onOpenChange,
  currentCaption,
  imageUrls,
  onApplyCaption,
}: CaptionHelperDialogProps) {
  const [userRequest, setUserRequest] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedCaption, setGeneratedCaption] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!userRequest.trim()) return;

    setIsGenerating(true);
    setGeneratedCaption("");

    try {
      const res = await fetch("/api/caption-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userRequest,
          currentCaption,
          imageUrls,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to generate caption");
      }

      const data = await res.json();
      setGeneratedCaption(data.caption);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate caption");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedCaption);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    onApplyCaption(generatedCaption);
    onOpenChange(false);
    setUserRequest("");
    setGeneratedCaption("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setUserRequest("");
    setGeneratedCaption("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Sparkles className="h-4 w-4 text-violet-400" />
            Caption Helper
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Describe what you want and AI will write a caption based on your images.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Images preview */}
          {imageUrls.length > 0 && (
            <div className="flex gap-2">
              {imageUrls.slice(0, 4).map((url, i) => (
                <img
                  key={i}
                  src={url}
                  alt={`Slide ${i + 1}`}
                  className="h-16 w-16 rounded-md object-cover border border-zinc-800"
                />
              ))}
              {imageUrls.length > 4 && (
                <div className="flex h-16 w-16 items-center justify-center rounded-md bg-zinc-900 border border-zinc-800 text-xs text-zinc-500">
                  +{imageUrls.length - 4}
                </div>
              )}
            </div>
          )}

          {/* Current caption context */}
          {currentCaption?.trim() && (
            <div className="rounded-md bg-zinc-900/50 border border-zinc-800 px-3 py-2">
              <p className="text-[10px] font-medium text-zinc-500 mb-1">Current caption</p>
              <p className="text-xs text-zinc-400 line-clamp-3 whitespace-pre-line">{currentCaption}</p>
            </div>
          )}

          <Separator className="bg-zinc-800" />

          {/* Request input */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-400">What do you want?</label>
            <Textarea
              value={userRequest}
              onChange={(e) => setUserRequest(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
              placeholder='e.g. "minimal but cute" · "something playful" · "rewrite this shorter" · "add a question at the end"'
              className="min-h-[80px] resize-none border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-600"
              autoFocus
            />
          </div>

          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !userRequest.trim()}
            className="w-full bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Writing caption...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate
              </>
            )}
          </Button>

          {/* Result */}
          {generatedCaption && (
            <>
              <Separator className="bg-zinc-800" />
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">Generated caption</label>
                <div className="relative rounded-lg border border-zinc-800 bg-zinc-900 p-3 pr-16">
                  <p className="text-sm leading-relaxed text-zinc-100 whitespace-pre-line">
                    {generatedCaption}
                  </p>
                  <div className="absolute right-2 top-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopy}
                      className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      {copied ? (
                        <><Check className="h-3 w-3" />Copied</>
                      ) : (
                        <><Copy className="h-3 w-3" />Copy</>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleApply}
                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Apply Caption
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleGenerate}
                    disabled={isGenerating}
                    className="gap-1 border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                    title="Regenerate"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                  >
                    Close
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
