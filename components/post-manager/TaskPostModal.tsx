"use client";

import { useEffect, useState } from "react";
import { PostPlan } from "@/lib/types";
import { Task } from "@/lib/task-types";
import { loadPosts, savePost } from "@/lib/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";
import { InstagramPreview } from "./InstagramPreview";
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Hash,
  ImageIcon,
  Loader2,
  Zap,
  Check,
  Send,
  GripVertical,
  Sparkles,
  Copy,
  UserRound,
} from "lucide-react";
import { CaptionHelperDialog } from "./CaptionHelperDialog";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CREATION_MODE_LABELS: Record<string, string> = {
  copy_post: "Copy Post",
  from_own_images: "Own Image",
  from_scratch: "From Scratch",
};

const POST_TYPE_LABELS: Record<string, string> = {
  single_image: "Single Image",
  carousel: "Carousel",
  reel_cover: "Reel Cover",
  story: "Story",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TaskPostModalProps {
  post: PostPlan | null;
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onApprove: (post: PostPlan) => void;
  onPublish: (post: PostPlan) => void;
  onPostUpdate: (post: PostPlan) => void;
}

export function TaskPostModal({
  post: initialPost,
  task,
  open,
  onOpenChange,
  onApprove,
  onPublish,
  onPostUpdate,
}: TaskPostModalProps) {
  // Local post state that can be refreshed via polling
  const [post, setPost] = useState<PostPlan | null>(initialPost);

  // Sync when prop changes (modal opens with new post)
  useEffect(() => {
    setPost(initialPost);
  }, [initialPost]);

  // Poll for updates during generation
  useEffect(() => {
    if (!post || post.status !== "generating") return;
    const interval = setInterval(() => {
      const fresh = loadPosts().find((p) => p.id === post.id);
      if (fresh) setPost(fresh);
      if (fresh?.status === "ready") clearInterval(interval);
    }, 2000);
    return () => clearInterval(interval);
  }, [post?.id, post?.status]);

  if (!post) return null;

  const isReady = ["ready", "publishing", "scheduled", "posted"].includes(post.status);
  const isPosted = post.status === "posted";

  // Resolve inspiration item from task
  const inspirationItem = task?.inspirationItems.find((i) => i.id === post.taskItemId);

  // Source images: prefer item's imageUrls (CDN), fallback to CDN refs from first prompt
  let sourceImages: string[] = [];
  if (inspirationItem && (inspirationItem.type === "own_image" || inspirationItem.type === "copy_post")) {
    sourceImages = inspirationItem.imageUrls.filter((u) => u.startsWith("http"));
  }
  // Fallback: CDN reference images from the first image prompt (injected during brainstorm)
  if (sourceImages.length === 0 && post.imagePrompts.length > 0) {
    sourceImages = (post.imagePrompts[0].referenceImages ?? []).filter(
      (u) => u.startsWith("https://") || u.startsWith("http://")
    );
  }

  const hasPrompts = post.imagePrompts.some((p) => p.prompt.trim());

  // Creation mode pill config
  const modeConfig: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
    copy_post: {
      label: "Copy Post",
      icon: <Copy className="mr-0.5 h-2.5 w-2.5" />,
      className: "border-blue-800 bg-blue-950/40 text-blue-400",
    },
    from_own_images: {
      label: "Own Image",
      icon: <UserRound className="mr-0.5 h-2.5 w-2.5" />,
      className: "border-emerald-800 bg-emerald-950/40 text-emerald-400",
    },
    from_scratch: {
      label: "From Scratch",
      icon: <Sparkles className="mr-0.5 h-2.5 w-2.5" />,
      className: "border-zinc-700 bg-zinc-900/50 text-zinc-400",
    },
  };
  const mode = modeConfig[post.creationMode] ?? modeConfig.from_scratch;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!w-[56rem] !max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950">
        {/* ── Header ──────────────────────────────────────────────── */}
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5 pr-8 text-zinc-100">
            <span className="flex-1">{post.title || "Untitled Post"}</span>
            <StatusBadge status={post.status} />
          </DialogTitle>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Badge className="bg-zinc-800 text-[10px] text-zinc-300 hover:bg-zinc-800">
              {POST_TYPE_LABELS[post.postType] || post.postType}
            </Badge>
            {post.taskId && (
              <Badge variant="outline" className="border-violet-800 bg-violet-950/30 text-[10px] text-violet-400">
                <Zap className="mr-0.5 h-2.5 w-2.5" />
                Task
              </Badge>
            )}
            <Badge variant="outline" className={`text-[10px] ${mode.className}`}>
              {mode.icon}
              {mode.label}
            </Badge>
            <span className="text-[10px] text-zinc-600">
              {new Date(post.createdAt).toLocaleString()}
            </span>
          </div>
        </DialogHeader>

        <div className="space-y-5 pb-2">
          {/* ── Section A: Creative Brief ─────────────────────────── */}
          <div className="space-y-3">
            {post.description && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">Description</p>
                <p className="text-sm text-zinc-300 leading-relaxed">{post.description}</p>
              </div>
            )}

            {post.caption && (
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 mb-1">Caption</p>
                <p className="text-sm text-zinc-200 leading-relaxed whitespace-pre-line">{post.caption}</p>
              </div>
            )}

            {post.hashtags.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {post.hashtags.map((tag, i) => (
                  <span key={i} className="inline-flex items-center gap-0.5 text-[11px] text-violet-400/80">
                    <Hash className="h-2.5 w-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            )}

            {post.notes && (
              <Collapsible>
                <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-400">
                  <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
                  Notes
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-1.5 rounded-md bg-zinc-900 border border-zinc-800 px-3 py-2">
                    <p className="text-xs text-zinc-400 leading-relaxed">{post.notes}</p>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}
          </div>

          {/* ── Section B: Prompts & Images ────────────────────────── */}
          {hasPrompts && (
            <>
              <Separator className="bg-zinc-800" />
              <div className="space-y-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                  Prompts & Images
                </p>

                {/* Source reference images */}
                {sourceImages.length > 0 && (
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                    <p className="text-[10px] font-medium text-zinc-500 mb-2">
                      {inspirationItem?.type === "copy_post" ? "Example Post" : "Source Image"}
                    </p>
                    <div className="flex gap-2">
                      {sourceImages.map((url, i) => (
                        <img
                          key={i}
                          src={url}
                          alt=""
                          className="h-20 w-20 rounded-md object-cover border border-zinc-700"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Slide cards */}
                {post.imagePrompts.map((prompt, i) => {
                  const generatedImage = post.generatedImages.find(
                    (g) => g.promptIndex === i && g.selected
                  );
                  // UserProvided slide: show photo-only card, no prompt needed
                  if (generatedImage?.userProvided) {
                    return (
                      <UserPhotoCard
                        key={i}
                        index={i}
                        total={post.imagePrompts.length}
                        image={generatedImage}
                      />
                    );
                  }
                  return prompt.prompt.trim() ? (
                    <SlideCard
                      key={i}
                      prompt={prompt}
                      index={i}
                      total={post.imagePrompts.length}
                      generatedImage={generatedImage}
                      isGenerating={post.status === "generating"}
                    />
                  ) : null;
                })}

                {post.status === "generating" && (
                  <div className="flex items-center gap-2 text-xs text-amber-400">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Generating images…
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Section C: Ready State — Preview + Edit ────────────── */}
          {isReady && !isPosted && (
            <>
              <Separator className="bg-zinc-800" />
              <ReadyStateEditor
                post={post}
                onPostUpdate={(updated) => {
                  setPost(updated);
                  onPostUpdate(updated);
                }}
              />
            </>
          )}

          {/* ── Section D: Publishing Info ────────────────────────── */}
          {isPosted && post.publishingInfo && (
            <>
              <Separator className="bg-zinc-800" />
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Published</p>
                {post.publishingInfo.publishedAt && (
                  <p className="text-xs text-zinc-400">
                    {new Date(post.publishingInfo.publishedAt).toLocaleString()}
                  </p>
                )}
                {post.publishingInfo.permalink && (
                  <a
                    href={post.publishingInfo.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
                  >
                    <ExternalLink className="h-3 w-3" />
                    View on Instagram
                  </a>
                )}
              </div>
            </>
          )}

          {/* ── Footer Actions ────────────────────────────────────── */}
          <Separator className="bg-zinc-800" />
          <div className="flex items-center justify-end gap-2">
            {post.status === "draft" && (
              <Button
                onClick={() => onApprove(post)}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                <Check className="mr-1.5 h-4 w-4" />
                Approve & Generate
              </Button>
            )}
            {post.status === "approved" && (
              <Button
                onClick={() => onApprove(post)}
                className="bg-violet-600 text-white hover:bg-violet-700"
              >
                <Loader2 className="mr-1.5 h-4 w-4" />
                Start Generation
              </Button>
            )}
            {post.status === "generating" && (
              <Button disabled className="bg-zinc-800 text-zinc-400">
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Generating…
              </Button>
            )}
            {post.status === "ready" && (
              <Button
                onClick={() => onPublish(post)}
                className="bg-emerald-600 text-white hover:bg-emerald-700"
              >
                <Send className="mr-1.5 h-4 w-4" />
                Publish to Instagram
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── User Photo Card ─────────────────────────────────────────────────────────

function UserPhotoCard({
  index,
  total,
  image,
}: {
  index: number;
  total: number;
  image: PostPlan["generatedImages"][number];
}) {
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex gap-3 p-3">
        <div className="shrink-0 w-28">
          <div className="relative overflow-hidden rounded-md border border-zinc-700">
            <img src={image.url} alt="" className="aspect-square w-full object-cover" />
            <div className="absolute bottom-1 left-1 rounded bg-emerald-900/80 px-1 py-0.5 text-[8px] text-emerald-300">
              yours
            </div>
          </div>
        </div>
        <div className="flex-1 min-w-0 space-y-2 pt-0.5">
          <p className="text-[10px] font-medium text-zinc-500">
            {total > 1 ? `Slide ${index + 1}` : "Your Photo"}
          </p>
          <p className="text-xs text-zinc-500 italic">Your original photo — used as slide 1</p>
        </div>
      </div>
    </div>
  );
}

// ── Slide Card ──────────────────────────────────────────────────────────────

function SlideCard({
  prompt,
  index,
  total,
  generatedImage,
  isGenerating,
}: {
  prompt: PostPlan["imagePrompts"][number];
  index: number;
  total: number;
  generatedImage?: PostPlan["generatedImages"][number];
  isGenerating: boolean;
}) {
  const [analysisOpen, setAnalysisOpen] = useState(false);

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex gap-3 p-3">
        {/* Left: Image slot */}
        <div className="shrink-0 w-28">
          {generatedImage ? (
            <div className="relative overflow-hidden rounded-md border border-zinc-700">
              <img
                src={generatedImage.url}
                alt=""
                className="aspect-square w-full object-cover"
              />
              {generatedImage.userProvided && (
                <div className="absolute bottom-1 left-1 rounded bg-emerald-900/80 px-1 py-0.5 text-[8px] text-emerald-300">
                  yours
                </div>
              )}
            </div>
          ) : (
            <div className="flex aspect-square w-full items-center justify-center rounded-md border border-dashed border-zinc-700 bg-zinc-900">
              {isGenerating ? (
                <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
              ) : (
                <ImageIcon className="h-5 w-5 text-zinc-700" />
              )}
            </div>
          )}
        </div>

        {/* Right: Prompt + analysis */}
        <div className="flex-1 min-w-0 space-y-2">
          <p className="text-[10px] font-medium text-zinc-500">
            {total > 1 ? `Slide ${index + 1}` : "Image Prompt"}
          </p>
          <p className="text-xs text-zinc-200 leading-relaxed font-mono">{prompt.prompt}</p>

          {prompt.referenceImageAnalysis && (
            <Collapsible open={analysisOpen} onOpenChange={setAnalysisOpen}>
              <CollapsibleTrigger className="flex items-center gap-1 text-[9px] font-medium text-zinc-600 hover:text-zinc-500">
                {analysisOpen ? (
                  <ChevronDown className="h-2.5 w-2.5" />
                ) : (
                  <ChevronRight className="h-2.5 w-2.5" />
                )}
                Reference Analysis
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-1 rounded bg-zinc-950 border border-zinc-800 px-2 py-1.5">
                  <p className="text-[10px] text-zinc-500 leading-relaxed">
                    {prompt.referenceImageAnalysis}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Ready State Editor ─────────────────────────────────────────────────────

function ReadyStateEditor({
  post,
  onPostUpdate,
}: {
  post: PostPlan;
  onPostUpdate: (post: PostPlan) => void;
}) {
  const [caption, setCaption] = useState(post.caption);
  const [hashtagsText, setHashtagsText] = useState(post.hashtags.join(", "));
  const [isDirty, setIsDirty] = useState(false);
  const [captionHelperOpen, setCaptionHelperOpen] = useState(false);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const selectedImages = post.generatedImages.filter((i) => i.selected);
  const selectedImageUrls = selectedImages.map((i) => i.url);

  // Build a live preview post with current edits
  const previewPost: PostPlan = {
    ...post,
    caption,
    hashtags: hashtagsText
      .split(",")
      .map((t) => t.trim().replace(/^#/, ""))
      .filter(Boolean),
  };

  const handleSave = () => {
    const updated: PostPlan = {
      ...post,
      caption,
      hashtags: previewPost.hashtags,
      updatedAt: new Date().toISOString(),
    };
    onPostUpdate(updated);
    savePost(updated);
    setIsDirty(false);
  };

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newSelected = [...selectedImages];
    const dragged = newSelected[draggedIndex];
    newSelected.splice(draggedIndex, 1);
    newSelected.splice(index, 0, dragged);

    const selectedIds = new Set(newSelected.map((img) => img.id));
    const nonSelected = post.generatedImages.filter((img) => !selectedIds.has(img.id));
    const reordered = [...newSelected, ...nonSelected];

    const updated = { ...post, generatedImages: reordered };
    onPostUpdate(updated);
    savePost(updated);
    setDraggedIndex(index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        Review & Edit
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: Instagram Preview */}
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
          <InstagramPreview
            post={previewPost}
            account={{ connected: false }}
          />
        </div>

        {/* Right: Edit panel */}
        <div className="space-y-3">
          {/* Image reorder */}
          {selectedImages.length > 1 && (
            <div>
              <p className="text-[10px] font-medium text-zinc-500 mb-1.5">
                Image Order <span className="text-zinc-600">· drag to reorder</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedImages.map((img, index) => (
                  <div
                    key={img.id}
                    draggable
                    onDragStart={() => handleDragStart(index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDragEnd={handleDragEnd}
                    className="group relative shrink-0 cursor-move overflow-hidden rounded-md border-2 border-violet-600 bg-zinc-900"
                    style={{ width: "64px" }}
                  >
                    <img src={img.url} alt="" className="aspect-square w-full object-cover" />
                    <div className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[8px] font-semibold text-white">
                      {index + 1}
                    </div>
                    <div className="absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                      <GripVertical className="h-2.5 w-2.5 text-zinc-300" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Caption */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-medium text-zinc-500">Caption</label>
              <button
                type="button"
                onClick={() => setCaptionHelperOpen(true)}
                className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-violet-400 hover:bg-violet-950/30 hover:text-violet-300 transition-colors"
              >
                <Sparkles className="h-2.5 w-2.5" />
                AI Helper
              </button>
            </div>
            <Textarea
              value={caption}
              onChange={(e) => {
                setCaption(e.target.value);
                setIsDirty(true);
              }}
              className="min-h-[100px] resize-none border-zinc-800 bg-zinc-900 text-xs text-zinc-100"
              placeholder="Instagram caption"
            />
          </div>

          {/* Hashtags */}
          <div>
            <label className="text-[10px] font-medium text-zinc-500">Hashtags</label>
            <Input
              value={hashtagsText}
              onChange={(e) => {
                setHashtagsText(e.target.value);
                setIsDirty(true);
              }}
              className="mt-0.5 h-8 text-xs border-zinc-800 bg-zinc-900"
              placeholder="tag1, tag2, tag3"
            />
            <p className="mt-0.5 text-[9px] text-zinc-600">Comma-separated, # optional</p>
          </div>

          {/* Save */}
          {isDirty && (
            <Button
              size="sm"
              onClick={handleSave}
              className="w-full bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
            >
              <Check className="mr-1.5 h-3.5 w-3.5" />
              Save Changes
            </Button>
          )}
        </div>
      </div>

      <CaptionHelperDialog
        open={captionHelperOpen}
        onOpenChange={setCaptionHelperOpen}
        currentCaption={caption}
        imageUrls={selectedImageUrls}
        onApplyCaption={(newCaption) => {
          setCaption(newCaption);
          setIsDirty(true);
        }}
      />
    </div>
  );
}
