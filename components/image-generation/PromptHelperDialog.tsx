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
import { Loader2, Sparkles, Copy, Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface PromptHelperDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentPrompt: string;
  referenceImages: string[];
  onApplyPrompt: (prompt: string) => void;
}

export function PromptHelperDialog({
  open,
  onOpenChange,
  currentPrompt,
  referenceImages,
  onApplyPrompt,
}: PromptHelperDialogProps) {
  const [userInput, setUserInput] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedPrompt, setGeneratedPrompt] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!userInput.trim()) return;

    setIsGenerating(true);
    setGeneratedPrompt("");

    try {
      const response = await fetch("/api/prompt-helper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userInput,
          currentPrompt,
          referenceImages,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to generate prompt");
      }

      const data = await response.json();
      setGeneratedPrompt(data.prompt);
      toast.success("Prompt generated!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate prompt");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(generatedPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = () => {
    onApplyPrompt(generatedPrompt);
    onOpenChange(false);
    setUserInput("");
    setGeneratedPrompt("");
  };

  const handleClose = () => {
    onOpenChange(false);
    setUserInput("");
    setGeneratedPrompt("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Sparkles className="h-5 w-5 text-violet-400" />
            Prompt Helper
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Describe what you want in natural language. The AI will analyze your
            reference images and create an optimized Seedream 4.5 prompt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-hidden">
          {/* Context preview */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">Context</label>
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-2">
                  {referenceImages.slice(0, 3).map((img, i) => (
                    <img
                      key={i}
                      src={img}
                      alt={`Reference ${i + 1}`}
                      className="h-12 w-12 rounded object-cover"
                    />
                  ))}
                  {referenceImages.length > 3 && (
                    <div className="flex h-12 w-12 items-center justify-center rounded bg-zinc-800 text-xs text-zinc-500">
                      +{referenceImages.length - 3}
                    </div>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-zinc-500">
                    {referenceImages.length} reference image
                    {referenceImages.length !== 1 && "s"}
                  </p>
                  {currentPrompt && (
                    <p className="mt-1 truncate text-xs text-zinc-600">
                      Current: {currentPrompt.slice(0, 80)}...
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <Separator className="bg-zinc-800" />

          {/* User input */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-zinc-400">
              What do you need?
            </label>
            <Textarea
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="Describe what you want in natural language. Examples: 'Help me create an image of her swimming' or 'Make the lighting more dramatic' or 'Change the setting to a beach at sunset'"
              className="min-h-[120px] w-full resize-none border-zinc-800 bg-zinc-900 text-sm text-zinc-100 placeholder:text-zinc-600"
            />
          </div>

          {/* Generate button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !userInput.trim()}
            className="w-full bg-violet-600 text-white hover:bg-violet-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating prompt...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Optimized Prompt
              </>
            )}
          </Button>

          {/* Result */}
          {generatedPrompt && (
            <>
              <Separator className="bg-zinc-800" />
              <div className="space-y-2">
                <label className="text-xs font-medium text-zinc-400">
                  Generated Prompt
                </label>
                <div className="relative rounded-lg border border-zinc-800 bg-zinc-900 p-3">
                  <p className="pr-20 text-sm leading-relaxed text-zinc-100">
                    {generatedPrompt}
                  </p>
                  <div className="absolute right-2 top-2 flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={handleCopy}
                      className="h-7 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy
                        </>
                      )}
                    </Button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={handleApply}
                    className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700"
                  >
                    Apply to Prompt
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClose}
                    className="border-zinc-700 text-zinc-300"
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
