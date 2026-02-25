"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import {
  ImagePlus,
  Sparkles,
  X,
  Upload,
  Loader2,
  Copy,
  PenLine,
  ImageIcon,
  Library,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CreationMode, PostType } from "@/lib/types";
import { InfoTooltip } from "@/components/image-generation/InfoTooltip";
import { tooltips } from "@/lib/tooltips";
import { ReferenceLibraryDialog } from "../reference-library/ReferenceLibraryDialog";
import type { ReferenceImage } from "@/lib/types";
import { loadIdentity, buildPersonaContext } from "@/lib/identity";

interface IdeaInputProps {
  onGenerate: (
    idea: string,
    images: string[],
    creationMode: CreationMode,
    postType: PostType
  ) => void;
  isLoading: boolean;
}

const POST_TYPE_OPTIONS: { value: PostType; label: string; desc: string }[] = [
  {
    value: "single_image",
    label: "Single Image",
    desc: "Standard feed photo",
  },
  {
    value: "carousel",
    label: "Carousel",
    desc: "Multi-image swipe post",
  },
  {
    value: "reel_cover",
    label: "Reel Cover",
    desc: "Video thumbnail",
  },
  {
    value: "story",
    label: "Story",
    desc: "Vertical 9:16, 24h",
  },
];

export function IdeaInput({ onGenerate, isLoading }: IdeaInputProps) {
  const [creationMode, setCreationMode] = useState<CreationMode | null>(null);
  const [postType, setPostType] = useState<PostType | null>(null);
  const [idea, setIdea] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  // ─── Image handling (file input, drag-and-drop, paste) ──────────────────

  const addImageFromFile = useCallback((file: File) => {
    if (!file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) setImages((prev) => [...prev, result]);
    };
    reader.readAsDataURL(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(addImageFromFile);
    e.target.value = "";
  };

  const removeImage = (index: number) => {
    setImages((prev) => prev.filter((_, i) => i !== index));
  };

  // Drag-and-drop
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

  // Paste anywhere on the component
  useEffect(() => {
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
  }, [addImageFromFile]);

  // ─── Submit ─────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!creationMode || !postType) return;
    if (!idea.trim() && images.length === 0) return;
    onGenerate(idea, images, creationMode, postType);
  };

  // Build persona context for API call if identity is active
  const getPersonaContext = useCallback(() => {
    const identity = loadIdentity();
    if (identity.isActive) {
      return buildPersonaContext(identity);
    }
    return undefined;
  }, []);

  const canSubmit =
    creationMode &&
    postType &&
    (idea.trim() || images.length > 0) &&
    !isLoading;

  const showCreationUI = creationMode && postType;

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5">
      {/* ── Step 1: Creation mode ─────────────────────────────────────── */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">Start with</label>
        <div className="grid grid-cols-3 gap-3">
          <button
            onClick={() => setCreationMode("from_scratch")}
            className={`flex flex-1 items-center gap-3 rounded-lg border p-4 text-left transition-all ${
              creationMode === "from_scratch"
                ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
                : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                creationMode === "from_scratch"
                  ? "bg-violet-500/20 text-violet-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              <PenLine className="h-4 w-4" />
            </div>
            <div>
              <p
                className={`text-sm font-medium ${
                  creationMode === "from_scratch"
                    ? "text-violet-300"
                    : "text-zinc-300"
                }`}
              >
                Start from scratch
              </p>
              <p className="text-xs text-zinc-500">
                Describe your idea, AI builds the plan
              </p>
            </div>
          </button>

          <button
            onClick={() => setCreationMode("copy_post")}
            className={`flex flex-1 items-center gap-3 rounded-lg border p-4 text-left transition-all ${
              creationMode === "copy_post"
                ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
                : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                creationMode === "copy_post"
                  ? "bg-violet-500/20 text-violet-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              <Copy className="h-4 w-4" />
            </div>
            <div>
              <p
                className={`text-sm font-medium ${
                  creationMode === "copy_post"
                    ? "text-violet-300"
                    : "text-zinc-300"
                }`}
              >
                Copy from other post
              </p>
              <p className="text-xs text-zinc-500">
                Upload a post to recreate with your character
              </p>
            </div>
          </button>

          <button
            onClick={() => setCreationMode("from_own_images")}
            className={`flex flex-1 items-center gap-3 rounded-lg border p-4 text-left transition-all ${
              creationMode === "from_own_images"
                ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
                : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
            }`}
          >
            <div
              className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                creationMode === "from_own_images"
                  ? "bg-violet-500/20 text-violet-400"
                  : "bg-zinc-800 text-zinc-500"
              }`}
            >
              <ImageIcon className="h-4 w-4" />
            </div>
            <div>
              <p
                className={`text-sm font-medium ${
                  creationMode === "from_own_images"
                    ? "text-violet-300"
                    : "text-zinc-300"
                }`}
              >
                Start with own image
              </p>
              <p className="text-xs text-zinc-500">
                Upload your photos, AI adds caption & details
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* ── Step 2: Post type ─────────────────────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-400">
            Post type
          </label>
          <InfoTooltip text={tooltips.postType} />
        </div>
        <div className="flex gap-2">
          {POST_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPostType(opt.value)}
              className={`flex-1 rounded-lg border px-3 py-2.5 text-center transition-all ${
                postType === opt.value
                  ? "border-violet-500 bg-violet-500/10 ring-1 ring-violet-500/30"
                  : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-700 hover:bg-zinc-900"
              }`}
            >
              <p
                className={`text-sm font-medium ${
                  postType === opt.value ? "text-violet-300" : "text-zinc-300"
                }`}
              >
                {opt.label}
              </p>
              <p className="text-[10px] text-zinc-500">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>

      {/* ── Step 3: Creation UI (appears after mode + type selected) ── */}
      {showCreationUI && (
        <div className="animate-in fade-in slide-in-from-top-2 space-y-4 rounded-lg border border-zinc-800 bg-zinc-900/30 p-5 duration-300">
          {creationMode === "copy_post" ? (
            <CopyPostInput
              idea={idea}
              setIdea={setIdea}
              images={images}
              setImages={setImages}
              fileInputRef={fileInputRef}
              dropRef={dropRef}
              handleFileInput={handleFileInput}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              removeImage={removeImage}
            />
          ) : creationMode === "from_own_images" ? (
            <OwnImagesInput
              idea={idea}
              setIdea={setIdea}
              images={images}
              setImages={setImages}
              fileInputRef={fileInputRef}
              dropRef={dropRef}
              handleFileInput={handleFileInput}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              removeImage={removeImage}
            />
          ) : (
            <FromScratchInput
              idea={idea}
              setIdea={setIdea}
              images={images}
              setImages={setImages}
              fileInputRef={fileInputRef}
              dropRef={dropRef}
              handleFileInput={handleFileInput}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              removeImage={removeImage}
            />
          )}

          {/* Generate button */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-zinc-600">
              {creationMode === "copy_post"
                ? "The AI will analyze the images and create a recreation plan"
                : creationMode === "from_own_images"
                  ? "The AI will analyze your photos and generate caption & details"
                  : "The AI will flesh out your idea into a complete post plan"}
            </p>
            <Button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-violet-600 text-white hover:bg-violet-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {creationMode === "copy_post"
                    ? "Analyzing..."
                    : creationMode === "from_own_images"
                      ? "Analyzing..."
                      : "Generating plan..."}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {creationMode === "copy_post"
                    ? "Analyze & Plan"
                    : creationMode === "from_own_images"
                      ? "Analyze & Create"
                      : "Generate Plan"}
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

interface InputSectionProps {
  idea: string;
  setIdea: (v: string) => void;
  images: string[];
  setImages: React.Dispatch<React.SetStateAction<string[]>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  dropRef: React.RefObject<HTMLDivElement | null>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  removeImage: (i: number) => void;
}

/** "Start from scratch" — prompt-first with optional inspiration images */
function FromScratchInput({
  idea,
  setIdea,
  images,
  fileInputRef,
  handleFileInput,
  handleDragOver,
  handleDrop,
  removeImage,
}: InputSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        {/* Text input */}
        <div className="flex-1 space-y-2">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-zinc-400">
              Describe your idea
            </label>
            <InfoTooltip text={tooltips.fromScratch} />
          </div>
          <Textarea
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="e.g. Beach selfie at sunset, golden hour vibes, casual summer outfit..."
            className="min-h-[120px] resize-none border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
          />
        </div>

        {/* Image upload */}
        <div className="w-64 space-y-2">
          <label className="text-xs font-medium text-zinc-400">
            Inspiration images (optional)
          </label>
          <ImageDropZone
            images={images}
            fileInputRef={fileInputRef}
            handleFileInput={handleFileInput}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
            removeImage={removeImage}
            hint="Drag, paste, or click to add"
          />
        </div>
      </div>
    </div>
  );
}

/** "Copy from other post" — image-first with analysis */
function CopyPostInput({
  idea,
  setIdea,
  images,
  fileInputRef,
  handleFileInput,
  handleDragOver,
  handleDrop,
  removeImage,
}: InputSectionProps) {
  return (
    <div className="space-y-4">
      {/* Images are primary in copy mode */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-zinc-400">
            Source images to recreate
          </label>
          <InfoTooltip text={tooltips.copyPost} />
        </div>
        <ImageDropZone
          images={images}
          fileInputRef={fileInputRef}
          handleFileInput={handleFileInput}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          removeImage={removeImage}
          large
          hint="Drag, paste, or click — add the post(s) you want to recreate"
        />
      </div>

      {/* Optional notes */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">
          Additional notes (optional)
        </label>
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g. Change the outfit to a red dress, make it more moody, keep the same pose but move to a beach setting..."
          className="min-h-[80px] resize-none border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
        />
      </div>
    </div>
  );
}

/** "Start with own image" — upload final images with optional caption guidance */
function OwnImagesInput({
  idea,
  setIdea,
  images,
  setImages,
  fileInputRef,
  handleFileInput,
  handleDragOver,
  handleDrop,
  removeImage,
}: InputSectionProps) {
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);

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
    setImages((prev) => [...prev, ...base64Images]);
  };

  return (
    <div className="space-y-4">
      {/* Images are primary in own images mode */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-zinc-400">
            Photo(s) for your post
          </label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setShowLibraryPicker(true)}
            className="h-7 gap-1.5 border-zinc-700 text-xs text-zinc-400 hover:border-violet-600 hover:bg-violet-950/30 hover:text-violet-300"
          >
            <Library className="h-3 w-3" />
            Choose from Library
          </Button>
        </div>
        <ImageDropZone
          images={images}
          fileInputRef={fileInputRef}
          handleFileInput={handleFileInput}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          removeImage={removeImage}
          large
          hint="Drag, paste, or click — add your photos"
        />
      </div>

      {/* Optional notes for caption style */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-zinc-400">
          Additional notes (optional)
        </label>
        <Textarea
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="e.g. Keep the caption casual and fun, use travel-related hashtags, mention the location..."
          className="min-h-[80px] resize-none border-zinc-800 bg-zinc-900 text-zinc-100 placeholder:text-zinc-600"
        />
      </div>

      {/* Reference Library Dialog */}
      <ReferenceLibraryDialog
        open={showLibraryPicker}
        onOpenChange={setShowLibraryPicker}
        onImagesSelected={handleLibraryImagesSelected}
      />
    </div>
  );
}

/** Reusable image drop zone with drag-and-drop support */
function ImageDropZone({
  images,
  fileInputRef,
  handleFileInput,
  handleDragOver,
  handleDrop,
  removeImage,
  large,
  hint,
}: {
  images: string[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileInput: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  removeImage: (i: number) => void;
  large?: boolean;
  hint?: string;
}) {
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
                  alt={`Reference ${i + 1}`}
                  className={`rounded-md object-cover ${
                    large ? "h-28 w-28" : "h-14 w-14"
                  }`}
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
    </>
  );
}
