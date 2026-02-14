"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { Upload, X, Copy, Check, Images } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ReferenceLibraryDialog } from "@/components/reference-library/ReferenceLibraryDialog";
import type { ReferenceImage } from "@/lib/types";

interface ReferenceUploaderProps {
  images: string[];
  onChange: (images: string[]) => void;
  onInsertReference?: (figureNum: number) => void;
  /** When false, paste is ignored (e.g. when this tab is not active). Default true. */
  acceptPaste?: boolean;
}

export function ReferenceUploader({
  images,
  onChange,
  onInsertReference,
  acceptPaste = true,
}: ReferenceUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef(images);
  imagesRef.current = images;

  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [showLibraryDialog, setShowLibraryDialog] = useState(false);

  const addImageFromFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) {
          onChange([...imagesRef.current, result]);
        }
      };
      reader.readAsDataURL(file);
    },
    [onChange]
  );

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(addImageFromFile);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
  };

  const copyReference = (index: number) => {
    const text = `Figure ${index + 1}`;
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    if (onInsertReference) {
      onInsertReference(index + 1);
    }
  };

  const handleLibraryImagesSelected = async (selectedImages: ReferenceImage[]) => {
    // Convert ReferenceImage objects to base64 data URIs
    const base64Images: string[] = [];
    for (const img of selectedImages) {
      const res = await fetch(img.imagePath);
      const blob = await res.blob();
      const dataUri = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
      base64Images.push(dataUri);
    }
    onChange([...imagesRef.current, ...base64Images]);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const files = e.dataTransfer.files;
      Array.from(files).forEach(addImageFromFile);
    },
    [addImageFromFile]
  );

  useEffect(() => {
    if (!acceptPaste) return;
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            addImageFromFile(file);
            break;
          }
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [acceptPaste, addImageFromFile]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs font-medium text-zinc-400">
          Reference Images
        </label>
        <Button
          onClick={() => setShowLibraryDialog(true)}
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 border-zinc-700 text-xs text-zinc-400 hover:border-violet-600 hover:bg-violet-950/30 hover:text-violet-300"
        >
          <Images className="h-3 w-3" />
          Choose from Library
        </Button>
      </div>

      {/* Reference Library Dialog */}
      <ReferenceLibraryDialog
        open={showLibraryDialog}
        onOpenChange={setShowLibraryDialog}
        onImagesSelected={handleLibraryImagesSelected}
      />

      <div className="flex flex-wrap gap-3">
        {images.map((img, i) => (
          <div key={i} className="group relative">
            <div className="relative h-24 w-24 overflow-hidden rounded-lg border-2 border-zinc-700 bg-zinc-900 transition-all hover:border-violet-600">
              <img
                src={img}
                alt={`Figure ${i + 1}`}
                className="h-full w-full object-cover"
              />
              
              {/* Figure label - always visible, prominent */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent px-2 py-1.5 text-center">
                <span className="text-xs font-bold text-white">
                  Figure {i + 1}
                </span>
              </div>

              {/* Action buttons on hover */}
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 opacity-0 transition-all group-hover:bg-black/60 group-hover:opacity-100">
                <button
                  onClick={() => copyReference(i)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-violet-600 text-white transition-colors hover:bg-violet-700"
                  title={`Copy "Figure ${i + 1}" to clipboard`}
                >
                  {copiedIndex === i ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </button>
                <button
                  onClick={() => removeImage(i)}
                  className="flex h-7 w-7 items-center justify-center rounded-md bg-red-600 text-white transition-colors hover:bg-red-700"
                  title="Remove"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Upload zone: click, drag, or paste */}
        <div
          className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/30 transition-colors hover:border-zinc-500 hover:bg-zinc-900/50"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <Upload className="mb-1 h-4 w-4 text-zinc-500" />
          <span className="text-[10px] text-center text-zinc-500">
            Add image
          </span>
          <span className="text-[9px] text-zinc-600">or paste</span>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFiles}
        className="hidden"
      />

      {images.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] text-zinc-500">
            <span className="font-medium text-violet-400">Tip:</span> Hover over any image and click the{" "}
            <Copy className="inline h-3 w-3" /> button to copy its reference (e.g. "Figure 1") to your clipboard.
          </p>
          <div className="rounded-md bg-zinc-900/50 px-3 py-2 font-mono text-[10px] leading-relaxed text-zinc-400">
            <span className="text-zinc-500">Quick reference:</span>
            {images.map((_, i) => (
              <span key={i}>
                {" "}
                <button
                  onClick={() => copyReference(i)}
                  className="rounded px-1 text-violet-400 hover:bg-zinc-800"
                >
                  Figure {i + 1}
                </button>
                {i < images.length - 1 && <span className="text-zinc-700">·</span>}
              </span>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
