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
import { Upload, X, Loader2, ImageIcon } from "lucide-react";

interface OwnImageUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: (result: {
    title: string;
    description: string;
    caption: string;
    hashtags: string[];
    postType: "single_image" | "carousel";
    images: string[]; // base64 data URIs
  }) => void;
}

export function OwnImageUploadDialog({
  open,
  onOpenChange,
  onComplete,
}: OwnImageUploadDialogProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    // Validate file types
    const validFiles = files.filter((f) => f.type.startsWith("image/"));
    if (validFiles.length !== files.length) {
      toast.warning("Only image files are allowed");
    }

    setSelectedFiles(validFiles);

    // Generate previews
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviews((prev) => [...prev, reader.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const handleRemove = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleAnalyze = async () => {
    if (selectedFiles.length === 0) {
      toast.warning("Please upload at least one image");
      return;
    }

    setIsAnalyzing(true);

    try {
      // Convert files to base64
      const base64Images: string[] = [];
      for (const file of selectedFiles) {
        const reader = new FileReader();
        const result = await new Promise<string>((resolve) => {
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
        });
        base64Images.push(result);
      }

      // Call API to analyze with Gemini
      const response = await fetch("/api/analyze-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: base64Images }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to analyze images");
      }

      const result = await response.json();

      toast.success("Images analyzed successfully!");
      onComplete({
        ...result,
        images: base64Images,
      });

      // Reset state
      setSelectedFiles([]);
      setPreviews([]);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClose = () => {
    if (!isAnalyzing) {
      setSelectedFiles([]);
      setPreviews([]);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl border-zinc-800 bg-zinc-950">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <ImageIcon className="h-5 w-5 text-violet-400" />
            Start with Own Images
          </DialogTitle>
          <DialogDescription className="text-zinc-500">
            Upload your images and AI will analyze them to generate post details.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Upload area */}
          <div>
            <label
              htmlFor="image-upload"
              className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-800 bg-zinc-900/30 p-8 transition-colors hover:border-zinc-700 hover:bg-zinc-900/50"
            >
              <Upload className="h-8 w-8 text-zinc-600" />
              <p className="mt-2 text-sm text-zinc-400">
                Click to upload or drag and drop
              </p>
              <p className="mt-1 text-xs text-zinc-600">
                PNG, JPG, WEBP (max 5 images for carousel)
              </p>
            </label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              disabled={isAnalyzing}
            />
          </div>

          {/* Previews */}
          {previews.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium text-zinc-400">
                Selected Images ({previews.length})
              </p>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                {previews.map((preview, index) => (
                  <div
                    key={index}
                    className="group relative aspect-square overflow-hidden rounded-lg border border-zinc-800"
                  >
                    <img
                      src={preview}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {!isAnalyzing && (
                      <button
                        onClick={() => handleRemove(index)}
                        className="absolute right-1 top-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      >
                        <X className="h-3 w-3 text-white" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <Button
              onClick={handleAnalyze}
              disabled={selectedFiles.length === 0 || isAnalyzing}
              className="flex-1 bg-violet-600 text-white hover:bg-violet-700"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                "Analyze & Create Post"
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={isAnalyzing}
              className="border-zinc-700 text-zinc-300"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
