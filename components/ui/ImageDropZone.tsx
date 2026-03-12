"use client";

import { useRef, useCallback, useEffect, useState } from "react";
import { Upload, X, ImagePlus } from "lucide-react";

interface ImageDropZoneProps {
  images: string[];
  onChange: (images: string[]) => void;
  large?: boolean;
  hint?: string;
  /** Listen for paste events on the document */
  acceptPaste?: boolean;
}

export function ImageDropZone({
  images,
  onChange,
  large,
  hint,
  acceptPaste = true,
}: ImageDropZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);

  const addImageFromFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const result = ev.target?.result as string;
        if (result) onChange([...images, result]);
      };
      reader.readAsDataURL(file);
    },
    [images, onChange]
  );

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(addImageFromFile);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    onChange(images.filter((_, i) => i !== index));
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
          if (file) addImageFromFile(file);
        }
      }
    };
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [acceptPaste, addImageFromFile]);

  return (
    <>
      <div
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-zinc-700 bg-zinc-900/50 transition-colors hover:border-zinc-600 hover:bg-zinc-900 ${
          large ? "min-h-[160px]" : "min-h-[120px]"
        }`}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {images.length === 0 ? (
          <>
            <Upload className="mb-2 h-5 w-5 text-zinc-500" />
            <p className="text-xs text-zinc-500">
              {hint || "Click to upload"}
            </p>
            <p className="mt-1 text-[10px] text-zinc-600">
              or paste from clipboard
            </p>
          </>
        ) : (
          <div className="flex flex-wrap gap-2 p-3">
            {images.map((img, i) => (
              <div key={i} className="group relative">
                <img
                  src={img}
                  alt={`Image ${i + 1}`}
                  className={`rounded-md object-cover cursor-zoom-in ${
                    large ? "h-28 w-28" : "h-14 w-14"
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPreviewSrc(img);
                  }}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeImage(i);
                  }}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
                {large && (
                  <div className="absolute bottom-1 left-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    Image {i + 1}
                  </div>
                )}
              </div>
            ))}
            <div
              className={`flex items-center justify-center rounded-md border border-dashed border-zinc-700 ${
                large ? "h-28 w-28" : "h-14 w-14"
              }`}
            >
              <ImagePlus className="h-4 w-4 text-zinc-500" />
            </div>
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileInput}
        className="hidden"
      />
      {previewSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          onClick={() => setPreviewSrc(null)}
        >
          <img
            src={previewSrc}
            alt="Preview"
            className="max-h-[90vh] max-w-[90vw] rounded-lg object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
