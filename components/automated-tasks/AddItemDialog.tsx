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
import { Upload, ImageIcon, Sparkles, X, Loader2 } from "lucide-react";
import {
  OwnImageInspirationItem,
  CopyPostInspirationItem,
  FromScratchInspirationItem,
  InspirationItem,
  InspirationItemType,
} from "@/lib/task-types";
import { PostType } from "@/lib/types";
import { loadIdentity } from "@/lib/identity";

interface AddItemDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultPostType: PostType;
  onAdd: (item: InspirationItem) => void;
}

export function AddItemDialog({ open, onOpenChange, defaultPostType, onAdd }: AddItemDialogProps) {
  const [type, setType] = useState<InspirationItemType>("own_image");
  const [notes, setNotes] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([]);
  const [uploadedPreviews, setUploadedPreviews] = useState<string[]>([]); // data URIs for thumbnail display only
  const [styleMode, setStyleMode] = useState<string | null>(null);
  const [location, setLocation] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const identity = loadIdentity();

  const resetState = () => {
    setNotes("");
    setUploading(false);
    setUploadedUrls([]);
    setUploadedPreviews([]);
    setStyleMode(null);
    setLocation(null);
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setUploading(true);
    const newPreviews: string[] = [];
    const newUrls: string[] = [];

    for (const file of Array.from(files)) {
      // Create preview data URI
      const reader = new FileReader();
      const preview = await new Promise<string>((resolve) => {
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.readAsDataURL(file);
      });
      newPreviews.push(preview);

      // Upload to CDN
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: preview }),
        });
        if (res.ok) {
          const { url } = await res.json();
          newUrls.push(url);
        } else {
          console.error("Upload failed for file:", file.name);
        }
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
    } else if (type === "copy_post") {
      item = {
        ...base,
        type: "copy_post",
        imageUrls: uploadedUrls,
        thumbnailUrl: uploadedUrls[0],
        postType: defaultPostType,
      } as CopyPostInspirationItem;
    } else {
      item = {
        ...base,
        type: "from_scratch",
        preferredStyleMode: styleMode,
        preferredLocation: location,
        postType: defaultPostType,
      } as FromScratchInspirationItem;
    }

    onAdd(item);
    handleClose();
  };

  const canAdd = () => {
    if (type === "own_image" || type === "copy_post") {
      return uploadedUrls.length > 0 && !uploading;
    }
    return true; // from_scratch always valid
  };

  const typeLabels: Record<InspirationItemType, string> = {
    own_image: "Own Image",
    copy_post: "Copy Post",
    from_scratch: "From Scratch",
  };

  const typeIcons: Record<InspirationItemType, typeof ImageIcon> = {
    own_image: ImageIcon,
    copy_post: Upload,
    from_scratch: Sparkles,
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="border-zinc-800 bg-zinc-900 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Add Inspiration Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Type selector */}
          <div>
            <label className="text-xs font-medium text-zinc-400">Type</label>
            <div className="mt-1 flex gap-2">
              {(["own_image", "copy_post", "from_scratch"] as InspirationItemType[]).map((t) => {
                const Icon = typeIcons[t];
                return (
                  <button
                    key={t}
                    onClick={() => { setType(t); setUploadedUrls([]); setUploadedPreviews([]); }}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded px-3 py-2 text-xs font-medium transition-colors ${
                      type === t
                        ? "bg-violet-900 text-violet-300"
                        : "bg-zinc-800 text-zinc-400 hover:bg-zinc-700"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {typeLabels[t]}
                  </button>
                );
              })}
            </div>
            <p className="mt-1.5 text-[11px] text-zinc-500">
              {type === "own_image" && "Your image becomes the post (or carousel slide 1). No AI character reference needed."}
              {type === "copy_post" && "Upload an example post to recreate. AI will match the composition with your character."}
              {type === "from_scratch" && "AI creates the post from scratch using your Identity Profile."}
            </p>
          </div>

          {/* Image upload (own_image + copy_post) */}
          {(type === "own_image" || type === "copy_post") && (
            <div>
              <label className="text-xs font-medium text-zinc-400">
                {type === "own_image" ? "Image(s)" : "Reference Post Image(s)"}
              </label>

              {/* Uploaded previews */}
              {uploadedPreviews.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {uploadedPreviews.map((src, idx) => (
                    <div key={idx} className="relative">
                      <img
                        src={src}
                        alt=""
                        className="h-16 w-16 rounded object-cover"
                      />
                      {idx >= uploadedUrls.length && (
                        <div className="absolute inset-0 flex items-center justify-center rounded bg-black/50">
                          <Loader2 className="h-4 w-4 animate-spin text-white" />
                        </div>
                      )}
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

              {/* Drop zone */}
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
                multiple={type === "copy_post" || defaultPostType === "carousel"}
                className="hidden"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>
          )}

          {/* From scratch options */}
          {type === "from_scratch" && (
            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-400">Style Mode</label>
                <p className="text-[10px] text-zinc-600">Leave empty to let AI pick</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setStyleMode(null)}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${
                      styleMode === null
                        ? "bg-zinc-700 text-zinc-100"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    AI picks
                  </button>
                  {identity.styleModes.map((s) => (
                    <button
                      key={s.name}
                      onClick={() => setStyleMode(s.name)}
                      className={`rounded px-2.5 py-1 text-xs transition-colors ${
                        styleMode === s.name
                          ? "bg-violet-900 text-violet-300"
                          : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      }`}
                    >
                      {s.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-zinc-400">Location</label>
                <p className="text-[10px] text-zinc-600">Leave empty to let AI pick</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setLocation(null)}
                    className={`rounded px-2.5 py-1 text-xs transition-colors ${
                      location === null
                        ? "bg-zinc-700 text-zinc-100"
                        : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                    }`}
                  >
                    AI picks
                  </button>
                  {identity.preferredLocations.map((l) => (
                    <button
                      key={l}
                      onClick={() => setLocation(l)}
                      className={`rounded px-2.5 py-1 text-xs transition-colors ${
                        location === l
                          ? "bg-violet-900 text-violet-300"
                          : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                      }`}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

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
