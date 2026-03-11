"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Upload, ImageIcon, X, Loader2, Images, Check, ChevronUp, ChevronDown } from "lucide-react";
import {
  OwnImageInspirationItem,
  CopyPostInspirationItem,
  InspirationItem,
} from "@/lib/task-types";
import { PostType, ReferenceImage } from "@/lib/types";

type ItemType = "own_image" | "copy_post";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPostType: PostType;
  onAdd: (item: InspirationItem) => void;
}

type ImageSource = "upload" | "library";

export function AddItemDialog({ open, onOpenChange, defaultPostType, onAdd }: AddItemDialogProps) {
  const [type, setType] = useState<ItemType>("own_image");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploadedPreviews, setUploadedPreviews] = useState<string[]>([]);
  const [imageSource, setImageSource] = useState<ImageSource>("upload");
  const [libraryImages, setLibraryImages] = useState<ReferenceImage[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [selectedLibraryIds, setSelectedLibraryIds] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isCarousel = defaultPostType === "carousel";

  const resetState = () => {
    setNotes("");
    setUploading(false);
    setUploadedUrls([]);
    setUploadedPreviews([]);
    setImageSource("upload");
    setSelectedLibraryIds(new Set());
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleImageSourceChange = (nextSource: ImageSource) => {
    setImageSource(nextSource);

    if (nextSource !== "library" || libraryImages.length > 0 || libraryLoading) {
      return;
    }

    setLibraryLoading(true);
    fetch("/api/reference-images")
      .then((res) => res.json())
      .then((data) => setLibraryImages(data.images || []))
      .catch((err) => console.error("Failed to load library:", err))
      .finally(() => setLibraryLoading(false));
  };

  const uploadImageSource = async (payload: { dataUri?: string; src?: string }) => {
    const response = await fetch("/api/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(data?.error || "Upload failed");
    }

    const data = await response.json();
    return data.url as string;
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const newPreviews: string[] = [];
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      const reader = new FileReader();
      const preview = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      newPreviews.push(preview);

      try {
        const url = await uploadImageSource({ dataUri: preview });
        newUrls.push(url);
      } catch (err) {
        console.error("Upload error:", err);
      }
    }

    setUploadedPreviews((prev) => [...prev, ...newPreviews]);
    setUploadedUrls((prev) => [...prev, ...newUrls]);
    setUploading(false);
  };

  const removeImage = (idx: number) => {
    setUploadedPreviews((prev) => prev.filter((_, i) => i !== idx));
    setUploadedUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const moveImage = (idx: number, direction: "up" | "down") => {
    const targetIdx = direction === "up" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= uploadedUrls.length) return;

    setUploadedPreviews((prev) => {
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
    setUploadedUrls((prev) => {
      const next = [...prev];
      [next[idx], next[targetIdx]] = [next[targetIdx], next[idx]];
      return next;
    });
  };

  const toggleLibraryImage = (img: ReferenceImage) => {
    setSelectedLibraryIds((prev) => {
      const next = new Set(prev);
      if (next.has(img.id)) {
        next.delete(img.id);
      } else {
        next.add(img.id);
      }
      return next;
    });
  };

  const handleAddFromLibrary = async () => {
    if (selectedLibraryIds.size === 0) return;

    setUploading(true);
    const selected = libraryImages.filter((img) => selectedLibraryIds.has(img.id));
    const urls: string[] = [];
    const previews: string[] = [];

    for (const img of selected) {
      try {
        previews.push(img.thumbnailPath);
        const url = await uploadImageSource({
          src: img.referencePath || img.imagePath,
        });
        urls.push(url);
      } catch (err) {
        console.error("Library upload error:", err);
      }
    }

    setUploadedPreviews((prev) => [...prev, ...previews]);
    setUploadedUrls((prev) => [...prev, ...urls]);
    setSelectedLibraryIds(new Set());
    setUploading(false);
  };

  const handleAdd = () => {
    const base = {
      id: crypto.randomUUID(),
      status: "pending" as const,
      notes: notes.trim(),
      usedAt: null,
    };

    let item: InspirationItem;

    if (type === "own_image") {
      item = {
        ...base,
        type: "own_image",
        imageUrls: uploadedUrls,
        postType: defaultPostType,
      } as OwnImageInspirationItem;
    } else {
      item = {
        ...base,
        type: "copy_post",
        imageUrls: uploadedUrls,
        thumbnailUrl: uploadedUrls[0],
        postType: defaultPostType,
      } as CopyPostInspirationItem;
    }

    onAdd(item);
    handleClose();
  };

  const canAdd = () => {
    return uploadedUrls.length > 0 && !uploading;
  };

  const typeConfig: Record<ItemType, { label: string; icon: typeof ImageIcon; description: string }> = {
    own_image: {
      label: "Own Image",
      icon: ImageIcon,
      description: "Your image becomes the post (or carousel slide 1). No AI character reference needed.",
    },
    copy_post: {
      label: "Example Post",
      icon: Upload,
      description: "Upload an example post to recreate. AI will match the composition with your character.",
    },
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-zinc-800 bg-zinc-900 max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Add Inspiration Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-zinc-400">Type</label>
            <div className="mt-1 flex gap-2">
              {(["own_image", "copy_post"] as ItemType[]).map((t) => {
                const config = typeConfig[t];
                const Icon = config.icon;
                return (
                  <button
                    key={t}
                    onClick={() => { setType(t); setUploadedUrls([]); setUploadedPreviews([]); setSelectedLibraryIds(new Set()); }}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium transition-colors ${
                      type === t
                        ? "bg-violet-900 text-violet-300"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {config.label}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              {typeConfig[type].description}
            </p>
          </div>

          {/* Image section */}
          <div>
            <label className="text-xs font-medium text-zinc-400">
              {type === "own_image" ? "Image(s)" : "Reference Post Image(s)"}
            </label>

            {/* Carousel hint for copy_post */}
            {type === "copy_post" && isCarousel && (
              <p className="mt-0.5 text-[10px] text-zinc-600">
                Add one image to copy the style, or multiple to recreate the full carousel in order.
              </p>
            )}

            {/* Source toggle (own_image only) */}
            {type === "own_image" && (
              <div className="mt-1.5 flex gap-1.5">
                <button
                  onClick={() => handleImageSourceChange("upload")}
                  className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                    imageSource === "upload"
                      ? "bg-zinc-700 text-zinc-100"
                      : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                  }`}
                >
                  <Upload className="h-3 w-3" />
                  Upload
                </button>
                <button
                  onClick={() => handleImageSourceChange("library")}
                  className={`flex items-center gap-1 rounded px-2.5 py-1 text-xs transition-colors ${
                    imageSource === "library"
                      ? "bg-zinc-700 text-zinc-100"
                      : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                  }`}
                >
                  <Images className="h-3 w-3" />
                  From Library
                </button>
              </div>
            )}

            {/* Uploaded previews with ordering */}
            {uploadedPreviews.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {uploadedPreviews.map((src, idx) => (
                  <div key={idx} className="relative group">
                    <img
                      src={src}
                      alt=""
                      className="h-16 w-16 rounded object-cover"
                    />
                    {/* Slide number */}
                    {uploadedPreviews.length > 1 && (
                      <div className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-sm bg-black/70 text-[9px] font-bold text-white">
                        {idx + 1}
                      </div>
                    )}
                    {/* Upload spinner */}
                    {idx >= uploadedUrls.length && (
                      <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </div>
                    )}
                    {/* Reorder buttons (only when fully uploaded and multiple images) */}
                    {uploadedUrls.length > 1 && idx < uploadedUrls.length && (
                      <div className="absolute right-0 top-0 flex flex-col opacity-0 group-hover:opacity-100 transition-opacity">
                        {idx > 0 && (
                          <button
                            onClick={() => moveImage(idx, "up")}
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-black/70 text-white hover:bg-violet-600"
                          >
                            <ChevronUp className="h-2.5 w-2.5" />
                          </button>
                        )}
                        {idx < uploadedUrls.length - 1 && (
                          <button
                            onClick={() => moveImage(idx, "down")}
                            className="flex h-3.5 w-3.5 items-center justify-center rounded-sm bg-black/70 text-white hover:bg-violet-600"
                          >
                            <ChevronDown className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </div>
                    )}
                    {/* Remove button */}
                    <button
                      onClick={() => removeImage(idx)}
                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-white"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Library picker (own_image only) */}
            {type === "own_image" && imageSource === "library" && (
              <div className="mt-2">
                {libraryLoading ? (
                  <div className="flex items-center justify-center rounded border border-dashed border-zinc-700 p-6">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
                    <span className="ml-2 text-xs text-zinc-500">Loading library...</span>
                  </div>
                ) : libraryImages.length === 0 ? (
                  <div className="rounded border border-dashed border-zinc-700 p-4 text-center">
                    <p className="text-xs text-zinc-500">No images in Reference Library</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-5 gap-1.5 max-h-48 overflow-y-auto rounded border border-zinc-700 p-2">
                      {libraryImages.map((img) => {
                        const isSelected = selectedLibraryIds.has(img.id);
                        return (
                          <button
                            key={img.id}
                            onClick={() => toggleLibraryImage(img)}
                            className={`relative aspect-square overflow-hidden rounded transition-all ${
                              isSelected
                                ? "ring-2 ring-violet-500"
                                : "hover:ring-1 hover:ring-zinc-600"
                            }`}
                          >
                            <img
                              src={img.thumbnailPath}
                              alt={img.summary}
                              className="h-full w-full object-cover"
                            />
                            {isSelected && (
                              <div className="absolute inset-0 flex items-center justify-center bg-violet-600/30">
                                <Check className="h-4 w-4 text-white" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                    {selectedLibraryIds.size > 0 && (
                      <Button
                        size="sm"
                        onClick={handleAddFromLibrary}
                        disabled={uploading}
                        className="mt-2 bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
                      >
                        {uploading ? (
                          <>
                            <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                            Uploading {selectedLibraryIds.size} image(s)...
                          </>
                        ) : (
                          <>Add {selectedLibraryIds.size} from library</>
                        )}
                      </Button>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Drop zone (upload mode or copy_post) */}
            {(imageSource === "upload" || type === "copy_post") && (
              <>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    handleFileSelect(e.dataTransfer.files);
                  }}
                  className="mt-2 flex cursor-pointer flex-col items-center justify-center rounded border border-dashed border-zinc-700 p-4 text-center transition-colors hover:border-violet-600 hover:bg-violet-950/10"
                >
                  {uploading ? (
                    <Loader2 className="mb-1 h-5 w-5 animate-spin text-zinc-500" />
                  ) : (
                    <Upload className="mb-1 h-5 w-5 text-zinc-500" />
                  )}
                  <p className="text-xs text-zinc-500">
                    {uploading ? "Uploading..." : "Click or drag to add images"}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple={type === "copy_post" || isCarousel}
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files)}
                />
              </>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="text-xs font-medium text-zinc-400">Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional context for the AI (e.g. 'use a sunset vibe', 'match the relaxed energy')"
              className="mt-1 min-h-[60px] resize-none border-zinc-700 bg-zinc-950 text-zinc-100"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleAdd}
            disabled={!canAdd()}
            className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {uploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              "Add to Queue"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
