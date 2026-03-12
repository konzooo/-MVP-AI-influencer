"use client";

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { PostPlan, ReferenceImage, ImagePrompt } from "@/lib/types";
import { Task } from "@/lib/task-types";
import { deletePost, loadPosts, savePost } from "@/lib/store";
import { usePostActions } from "@/hooks/use-post-actions";
import { useInstagramAccount } from "@/hooks/use-instagram-account";
import { canPublish as checkRateLimit } from "@/lib/instagram-rate-limit";
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
import { Separator } from "@/components/ui/separator";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { InstagramPreview } from "@/components/post-manager/InstagramPreview";
import { PublishProgress } from "@/components/post-manager/PublishProgress";
import { AccountStatus } from "@/components/post-manager/AccountStatus";
import { CaptionHelperDialog } from "@/components/post-manager/CaptionHelperDialog";
import { PromptHelperDialog } from "@/components/image-generation/PromptHelperDialog";
import {
  GenerationControls,
  GenerationControlsSettings,
} from "@/components/image-generation/GenerationControls";
import { ImageDropZone } from "@/components/ui/ImageDropZone";
import { ReferenceLibraryDialog } from "@/components/reference-library/ReferenceLibraryDialog";
import { loadGeneratedImageLibrary } from "@/lib/generated-image-library";
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
  Sparkles,
  Copy,
  UserRound,
  Wand2,
  Square,
  X,
  ZoomIn,
  Upload,
  Pencil,
  Lock,
  RefreshCw,
  CalendarIcon,
  Clock,
  AlertCircle,
  Trash2,
  Library,
  Plus,
  PenTool,
} from "lucide-react";
import { toast } from "sonner";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CREATION_MODE_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; className: string }
> = {
  manual: {
    label: "Manual",
    icon: <PenTool className="mr-0.5 h-2.5 w-2.5" />,
    className: "border-amber-800 bg-amber-950/40 text-amber-300",
  },
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

const POST_TYPE_LABELS: Record<string, string> = {
  single_image: "Single Image",
  carousel: "Carousel",
  reel_cover: "Reel Cover",
  story: "Story",
};

function getReferenceStoragePath(image: ReferenceImage): string {
  return image.referencePath || image.imagePath;
}

function getReferencePreviewPath(image: ReferenceImage): string {
  return image.originalPath || image.imagePath;
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface PostViewModalProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Optional task context (when opened from task detail page) */
  task?: Task | null;
  /** Called when a post is deleted so parent can react */
  onDelete?: (id: string) => void;
}

export function PostViewModal({
  postId,
  open,
  onOpenChange,
  task,
  onDelete,
}: PostViewModalProps) {
  const [post, setPost] = useState<PostPlan | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Reference library state
  const [selectedRefs, setSelectedRefs] = useState<ReferenceImage[]>([]);
  const [refLoading, setRefLoading] = useState(false);
  const [refPickerOpen, setRefPickerOpen] = useState(false);

  // Prompt editing state
  const [editingPrompts, setEditingPrompts] = useState<ImagePrompt[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingCaption, setEditingCaption] = useState(false);
  const [promptEditMode, setPromptEditMode] = useState(false);
  const [promptHelperOpen, setPromptHelperOpen] = useState(false);
  const [promptHelperIndex, setPromptHelperIndex] = useState<number | null>(
    null
  );

  // Generation settings
  const [genSettings, setGenSettings] = useState<GenerationControlsSettings>({
    imageSize: "portrait_4_3",
    numVariations: 1,
    seed: "",
    maxImages: 1,
    enableSafetyChecker: true,
  });
  const [genSettingsOpen, setGenSettingsOpen] = useState(false);

  // Caption/hashtags editing (ready state)
  const [caption, setCaption] = useState("");
  const [hashtagsText, setHashtagsText] = useState("");
  const [captionDirty, setCaptionDirty] = useState(false);
  const [captionHelperOpen, setCaptionHelperOpen] = useState(false);

  // Publishing state
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date | undefined>(
    undefined
  );
  const [scheduledTime, setScheduledTime] = useState("12:00");

  // Drag reorder
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  const actions = usePostActions();
  const instagram = useInstagramAccount();

  // ─── Load post ──────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!open || !postId) {
      setPost(null);
      return;
    }

    const found = loadPosts().find((p) => p.id === postId);
    if (found) {
      setPost(found);
      return;
    }

    // Post not found yet — poll for new posts being created
    let pollTimeout: NodeJS.Timeout;
    const pollForPost = () => {
      const fresh = loadPosts().find((p) => p.id === postId);
      if (fresh) {
        setPost(fresh);
      } else {
        // Keep polling every 500ms for up to 30 seconds
        pollTimeout = setTimeout(pollForPost, 500);
      }
    };
    pollTimeout = setTimeout(pollForPost, 500);

    return () => clearTimeout(pollTimeout);
  }, [open, postId]);

  // Sync editable fields when post changes
  useEffect(() => {
    if (!post) return;
    setEditingPrompts(post.imagePrompts.map((ip) => ({ ...ip })));
    setCaption(post.caption);
    setHashtagsText(post.hashtags.join(", "));
    setCaptionDirty(false);
    setEditingTitle(false);
    setEditingDescription(false);
    setEditingCaption(false);
    setPromptEditMode(post.creationMode === "manual");
  }, [post?.id, post?.status]);

  // Clear lightbox when modal closes
  useEffect(() => {
    if (!open) {
      setLightboxUrl(null);
      setDeleteConfirm(false);
    }
  }, [open]);

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

  // Load reference library
  useEffect(() => {
    if (!open || !post) return;
    const hasEditableRefs =
      post.creationMode === "manual" ||
      post.creationMode === "copy_post" ||
      post.creationMode === "from_scratch" ||
      (post.creationMode === "from_own_images" && post.postType === "carousel");
    if (!hasEditableRefs) {
      setSelectedRefs([]);
      return;
    }

    setRefLoading(true);
    const generatedRefs = loadGeneratedImageLibrary();

    const resolveStoredRefs = (allRefs: ReferenceImage[]) => {
      if (post.characterRefs && post.characterRefs.length > 0) {
        return post.characterRefs
          .map((cr) => {
            if (cr.id.startsWith("upload-")) {
              return {
                id: cr.id,
                sourceKey: "uploaded",
                filename: "uploaded",
                imagePath: cr.path,
                originalPath: cr.path,
                referencePath: cr.path,
                thumbnailPath: cr.path,
                summary: "Uploaded image",
                tags: [],
                metadata: { schema_version: "1", indoor_outdoor: "unknown", place: { type: "unknown", detail: "" }, capture_method: "front_selfie", framing: "chest_up", expression: { type: "neutral", mouth: "closed", detail: "" }, time_of_day: "unknown", image_style: { color: "color", detail: "" } },
                createdAt: new Date().toISOString(),
              } as ReferenceImage;
            }

            return (
              allRefs.find((r) => r.id === cr.id) ??
              allRefs.find(
                (r) =>
                  r.imagePath === cr.path ||
                  r.originalPath === cr.path ||
                  r.referencePath === cr.path
              )
            );
          })
          .filter(Boolean) as ReferenceImage[];
      }

      if (post.selectedCharacterRefId) {
        const stored =
          allRefs.find((r) => r.id === post.selectedCharacterRefId) ??
          (post.selectedCharacterRefPath
            ? allRefs.find(
                (r) =>
                  r.imagePath === post.selectedCharacterRefPath ||
                  r.originalPath === post.selectedCharacterRefPath ||
                  r.referencePath === post.selectedCharacterRefPath
              )
            : undefined);
        return stored ? [stored] : [];
      }

      return null;
    };

    fetch("/api/reference-images")
      .then((res) => res.json())
      .then((data) => {
        const refs: ReferenceImage[] = data.images || [];
        const allRefs = [...generatedRefs, ...refs];

        const storedRefs = resolveStoredRefs(allRefs);
        if (storedRefs) {
          setSelectedRefs(storedRefs);
        } else if (
          post.creationMode === "from_own_images" &&
          post.postType === "carousel" &&
          post.characterRefs === undefined
        ) {
          const ownImage =
            post.generatedImages.find(
              (img) => img.userProvided && img.promptIndex === 0
            ) ?? post.generatedImages.find((img) => img.userProvided);

          if (ownImage?.url) {
            const fallbackRef: ReferenceImage = {
              id: `upload-own-${post.id}`,
              sourceKey: "uploaded",
              filename: "uploaded",
              imagePath: ownImage.url,
              originalPath: ownImage.url,
              referencePath: ownImage.url,
              thumbnailPath: ownImage.url,
              summary: "Own image reference",
              tags: [],
              metadata: {
                schema_version: "1",
                indoor_outdoor: "unknown",
                place: { type: "unknown", detail: "" },
                capture_method: "front_selfie",
                framing: "chest_up",
                expression: { type: "neutral", mouth: "closed", detail: "" },
                time_of_day: "unknown",
                image_style: { color: "color", detail: "" },
              },
              createdAt: new Date().toISOString(),
            };
            setSelectedRefs([fallbackRef]);

            const updated: PostPlan = {
              ...post,
              characterRefs: [{ id: fallbackRef.id, path: getReferenceStoragePath(fallbackRef) }],
              selectedCharacterRefId: fallbackRef.id,
              selectedCharacterRefPath: getReferenceStoragePath(fallbackRef),
            };
            setPost(updated);
            savePost(updated);
          } else {
            setSelectedRefs([]);
          }
        } else {
          setSelectedRefs([]);
        }
      })
      .catch(() => {
        const storedRefs = resolveStoredRefs(generatedRefs);
        setSelectedRefs(storedRefs || []);
      })
      .finally(() => setRefLoading(false));
  }, [open, post?.id, post?.selectedCharacterRefId]);

  // Auto-save caption/hashtags after 600ms
  useEffect(() => {
    if (!captionDirty || !post) return;
    const timer = setTimeout(() => {
      const updated: PostPlan = {
        ...post,
        caption,
        hashtags: hashtagsText
          .split(",")
          .map((t) => t.trim().replace(/^#/, ""))
          .filter(Boolean),
        updatedAt: new Date().toISOString(),
      };
      savePost(updated);
      setPost(updated);
    }, 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caption, hashtagsText]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const refreshPost = useCallback(() => {
    if (!postId) return;
    const fresh = loadPosts().find((p) => p.id === postId);
    if (fresh) setPost(fresh);
  }, [postId]);

  const applyCaptionToPost = useCallback((newCaption: string) => {
    if (!post) return;

    const normalizedCaption = newCaption.trim();
    const shouldSyncHashtags =
      post.status === "ready" ||
      post.status === "publishing" ||
      post.status === "scheduled" ||
      post.status === "posted";
    const updated: PostPlan = {
      ...post,
      caption: normalizedCaption,
      hashtags: shouldSyncHashtags
        ? hashtagsText
            .split(",")
            .map((t) => t.trim().replace(/^#/, ""))
            .filter(Boolean)
        : post.hashtags,
      updatedAt: new Date().toISOString(),
    };

    savePost(updated);
    setPost(updated);
    setCaption(normalizedCaption);
    setCaptionDirty(false);
    setEditingCaption(false);
  }, [hashtagsText, post]);

  const handleToggleRef = (ref: ReferenceImage) => {
    if (!post) return;
    const isAlreadySelected = selectedRefs.some((r) => r.id === ref.id);
    let newRefs: ReferenceImage[];
    if (isAlreadySelected) {
      newRefs = selectedRefs.filter((r) => r.id !== ref.id);
    } else {
      if (selectedRefs.length >= 10) return; // FAL limit
      newRefs = [...selectedRefs, ref];
    }
    setSelectedRefs(newRefs);
    const updated: PostPlan = {
      ...post,
      characterRefs: newRefs.map((r) => ({
        id: r.id,
        path: getReferenceStoragePath(r),
      })),
      // Also update legacy fields for backwards compat
      selectedCharacterRefId: newRefs[0]?.id,
      selectedCharacterRefPath: newRefs[0]
        ? getReferenceStoragePath(newRefs[0])
        : undefined,
    };
    setPost(updated);
    savePost(updated);
  };

  const handleRemoveRef = (refId: string) => {
    if (!post) return;
    const newRefs = selectedRefs.filter((r) => r.id !== refId);
    setSelectedRefs(newRefs);
    const updated: PostPlan = {
      ...post,
      characterRefs: newRefs.map((r) => ({
        id: r.id,
        path: getReferenceStoragePath(r),
      })),
      selectedCharacterRefId: newRefs[0]?.id,
      selectedCharacterRefPath: newRefs[0]
        ? getReferenceStoragePath(newRefs[0])
        : undefined,
    };
    setPost(updated);
    savePost(updated);
  };

  const handleAddUploadedRef = (dataUri: string) => {
    if (!post) return;
    if (selectedRefs.length >= 10) return;
    const uploadedRef: ReferenceImage = {
      id: `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sourceKey: "uploaded",
      filename: "uploaded",
      imagePath: dataUri,
      originalPath: dataUri,
      referencePath: dataUri,
      thumbnailPath: dataUri,
      summary: "Uploaded image",
      tags: [],
      metadata: {
        schema_version: "1",
        indoor_outdoor: "unknown",
        place: { type: "unknown", detail: "" },
        capture_method: "front_selfie",
        framing: "chest_up",
        expression: { type: "neutral", mouth: "closed", detail: "" },
        time_of_day: "unknown",
        image_style: { color: "color", detail: "" },
      },
      createdAt: new Date().toISOString(),
    };
    const newRefs = [...selectedRefs, uploadedRef];
    setSelectedRefs(newRefs);
    const updated: PostPlan = {
      ...post,
      characterRefs: newRefs.map((r) => ({
        id: r.id,
        path: getReferenceStoragePath(r),
      })),
      selectedCharacterRefId: newRefs[0]?.id,
      selectedCharacterRefPath: newRefs[0]
        ? getReferenceStoragePath(newRefs[0])
        : undefined,
    };
    setPost(updated);
    savePost(updated);
  };

  const handlePromptChange = (index: number, value: string) => {
    const updated = [...editingPrompts];
    updated[index] = { ...updated[index], prompt: value };
    setEditingPrompts(updated);

    // Persist immediately
    if (post) {
      const updatedPost = { ...post, imagePrompts: updated };
      savePost(updatedPost);
      setPost(updatedPost);
    }
  };

  const handlePromptRefImagesChange = (index: number, images: string[]) => {
    const updated = [...editingPrompts];
    updated[index] = { ...updated[index], referenceImages: images };
    setEditingPrompts(updated);

    if (post) {
      const updatedPost = { ...post, imagePrompts: updated };
      savePost(updatedPost);
      setPost(updatedPost);
    }
  };

  const handleManualImageUpload = (promptIndex: number, dataUri: string) => {
    if (!post) return;

    const nextImage = {
      id: `manual-${Date.now()}-${promptIndex}`,
      url: dataUri,
      prompt: editingPrompts[promptIndex]?.prompt || "Manual upload",
      selected: true,
      createdAt: new Date().toISOString(),
      promptIndex,
      userProvided: true,
      settings: {
        imageSize: genSettings.imageSize,
        numImages: 1,
        numVariations: 1,
        enableSafetyChecker: genSettings.enableSafetyChecker,
      },
    };

    const remainingImages = post.generatedImages.filter(
      (img) => !(img.promptIndex === promptIndex && img.userProvided)
    );

    const updated: PostPlan = {
      ...post,
      generatedImages: [nextImage, ...remainingImages],
    };
    setPost(updated);
    savePost(updated);
  };

  const handleRemoveManualImage = (promptIndex: number) => {
    if (!post) return;

    const updated: PostPlan = {
      ...post,
      generatedImages: post.generatedImages.filter(
        (img) => !(img.promptIndex === promptIndex && img.userProvided)
      ),
    };
    setPost(updated);
    savePost(updated);
  };

  const handleRefLibrarySelected = (selected: ReferenceImage[]) => {
    if (!post) return;
    // Add selected library images as character references (skip already selected)
    const existingIds = new Set(selectedRefs.map((r) => r.id));
    const newLibraryRefs = selected.filter((r) => !existingIds.has(r.id));
    const combined = [...selectedRefs, ...newLibraryRefs].slice(0, 10);
    setSelectedRefs(combined);
    const updated: PostPlan = {
      ...post,
      characterRefs: combined.map((r) => ({
        id: r.id,
        path: getReferenceStoragePath(r),
      })),
      selectedCharacterRefId: combined[0]?.id,
      selectedCharacterRefPath: combined[0]
        ? getReferenceStoragePath(combined[0])
        : undefined,
    };
    setPost(updated);
    savePost(updated);
  };

  const handleToggleSelect = (imageId: string) => {
    if (!post) return;
    const updated = post.generatedImages.map((img) =>
      img.id === imageId ? { ...img, selected: !img.selected } : img
    );
    const updatedPost = { ...post, generatedImages: updated };
    savePost(updatedPost);
    setPost(updatedPost);
  };

  const handleApproveAndGenerate = async () => {
    if (!post) return;
    const result = await actions.approveAndGenerate(post, {
      imageSize: genSettings.imageSize,
      task,
    });
    refreshPost();
  };

  const handleStopGeneration = () => {
    if (!post) return;
    actions.stopGeneration(post);
    refreshPost();
  };

  const handleRegenerateSlide = async (slideIndex: number) => {
    if (!post) return;
    await actions.regenerateSlide(post, slideIndex, {
      imageSize: genSettings.imageSize,
      numVariations: genSettings.numVariations,
      seed: genSettings.seed,
      enableSafetyChecker: genSettings.enableSafetyChecker,
    });
    refreshPost();
  };

  const handlePublish = async () => {
    if (!post) return;
    let scheduledTimestamp: number | undefined;
    if (isScheduled && scheduledDate) {
      const [hours, minutes] = scheduledTime.split(":").map(Number);
      const dt = new Date(scheduledDate);
      dt.setHours(hours, minutes, 0, 0);
      scheduledTimestamp = Math.floor(dt.getTime() / 1000);

      const minTime = Math.floor(Date.now() / 1000) + 10 * 60;
      const maxTime = Math.floor(Date.now() / 1000) + 75 * 24 * 60 * 60;
      if (scheduledTimestamp < minTime) {
        toast.error("Scheduled time must be at least 10 minutes from now.");
        return;
      }
      if (scheduledTimestamp > maxTime) {
        toast.error("Scheduled time must be within 75 days.");
        return;
      }
    }

    await actions.publishToInstagram(post, {
      scheduledTime: scheduledTimestamp,
    });
    refreshPost();
  };

  const handleDeletePost = () => {
    if (!post) return;
    deletePost(post.id);
    onDelete?.(post.id);
    onOpenChange(false);
    toast.success("Post deleted");
  };

  const handleDragStart = (index: number) => setDraggedIndex(index);
  const handleDragEnd = () => setDraggedIndex(null);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index || !post) return;

    const selected = post.generatedImages.filter((i) => i.selected);
    const newSelected = [...selected];
    const dragged = newSelected[draggedIndex];
    newSelected.splice(draggedIndex, 1);
    newSelected.splice(index, 0, dragged);

    const selectedIds = new Set(newSelected.map((img) => img.id));
    const nonSelected = post.generatedImages.filter(
      (img) => !selectedIds.has(img.id)
    );
    const reordered = [...newSelected, ...nonSelected];

    const updated = { ...post, generatedImages: reordered };
    savePost(updated);
    setPost(updated);
    setDraggedIndex(index);
  };

  // Intercept dialog close: if lightbox is open, close it first
  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen && lightboxUrl) {
      setLightboxUrl(null);
      return;
    }
    onOpenChange(nextOpen);
  };

  // Show loading state while post is being brainstormed
  const isLoading = open && postId && !post;

  if (!post) {
    return (
      <Dialog open={open && !!postId} onOpenChange={onOpenChange}>
        <DialogContent className="!w-[52rem] !max-w-[calc(100vw-2rem)] border-zinc-800 bg-zinc-950">
          <DialogHeader>
            <DialogTitle className="text-zinc-100">Loading post…</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="mb-4 inline-flex">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-violet-500" />
            </div>
            <p className="text-sm text-zinc-400">
              Creating your post…
            </p>
            <p className="mt-2 text-xs text-zinc-600">
              Brainstorming content and generating plan
            </p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isReady = ["ready", "publishing", "scheduled", "posted"].includes(
    post.status
  );
  const isPosted = post.status === "posted" || post.status === "scheduled";
  const isDraft = post.status === "draft";
  const isApproved = post.status === "approved";
  const isGenerating = post.status === "generating";
  const canEdit = isDraft || isApproved || post.status === "ready";
  const mode = CREATION_MODE_CONFIG[post.creationMode] ?? CREATION_MODE_CONFIG.from_scratch;
  const isManualPost = post.creationMode === "manual";
  const isOwnImageCarousel =
    post.creationMode === "from_own_images" && post.postType === "carousel";
  const canManuallyToggleStatus = !post.taskId && (isDraft || isApproved);

  // Publishing validation
  const selectedImages = post.generatedImages.filter((i) => i.selected);
  const fullCaption =
    post.caption +
    (post.hashtags.length
      ? "\n\n" + post.hashtags.map((t) => `#${t.replace(/^#/, "")}`).join(" ")
      : "");
  const captionTooLong = fullCaption.length > 2200;
  const tooManyHashtags = post.hashtags.length > 30;
  const rateLimitReached = !checkRateLimit();
  const canPublishNow =
    post.status === "ready" &&
    selectedImages.length > 0 &&
    post.caption.trim().length > 0 &&
    instagram.account.connected &&
    !captionTooLong &&
    !tooManyHashtags &&
    !rateLimitReached &&
    !actions.isPublishing;

  // Resolve inspiration item from task
  const inspirationItem = task?.inspirationItems.find(
    (i) => i.id === post.taskItemId
  );
  let sourceImages: string[] = [];
  if (
    inspirationItem &&
    (inspirationItem.type === "own_image" ||
      inspirationItem.type === "copy_post")
  ) {
    sourceImages = inspirationItem.imageUrls.filter((u) =>
      u.startsWith("http")
    );
  }
  if (sourceImages.length === 0 && post.imagePrompts.length > 0) {
    sourceImages = (post.imagePrompts[0].referenceImages ?? []).filter(
      (u) => u.startsWith("https://") || u.startsWith("http://")
    );
  }
  const captionHelperImageUrls = Array.from(
    new Set(
      (
        isReady
          ? selectedImages.map((img) => img.url)
          : [
              ...post.referenceImages,
              ...sourceImages,
              ...post.generatedImages
                .filter((img) => img.userProvided)
                .map((img) => img.url),
            ]
      ).filter(Boolean)
    )
  );

  const needsLibraryRef =
    post.creationMode === "copy_post" || post.creationMode === "from_scratch";
  const requiresReferenceSelection =
    isManualPost || needsLibraryRef || isOwnImageCarousel;
  const ownImageReference =
    isOwnImageCarousel
      ? post.generatedImages.find(
          (img) => img.userProvided && img.promptIndex === 0
        ) ?? post.generatedImages.find((img) => img.userProvided) ?? null
      : null;
  const showSourceImages = sourceImages.length > 0 && !isOwnImageCarousel;
  const referenceLabel =
    isManualPost || isOwnImageCarousel
      ? `Reference Images${selectedRefs.length > 0 ? ` (${selectedRefs.length}/10)` : ""}`
      : `Character Reference${selectedRefs.length > 0 ? `s (${selectedRefs.length}/10)` : ""}`;
  const missingReferenceTitle = isManualPost || isOwnImageCarousel
    ? "Add at least 1 reference image to generate"
    : "Add at least 1 character reference to generate";

  const handleStatusChange = (newStatus: "draft" | "approved") => {
    if (!canManuallyToggleStatus || newStatus === post.status) return;
    const updated: PostPlan = {
      ...post,
      status: newStatus,
    };
    setPost(updated);
    savePost(updated);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="!w-[56rem] !max-w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto border-zinc-800 bg-zinc-950">
          {/* ── Header ──────────────────────────────────────────────── */}
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2.5 pr-8 text-zinc-100">
              <div className="min-w-0 flex-1">
                {editingTitle ? (
                  <Input
                    value={post.title}
                    onChange={(e) => {
                      const updated = { ...post, title: e.target.value };
                      setPost(updated);
                      savePost(updated);
                    }}
                    onBlur={() => setEditingTitle(false)}
                    autoFocus
                    placeholder="Untitled Post"
                    className="h-auto border-zinc-800 bg-zinc-900 px-3 py-2 text-2xl font-semibold text-zinc-100"
                  />
                ) : (
                  <div className="flex min-w-0 items-start gap-2">
                    <span
                      className="min-w-0 cursor-pointer rounded px-1 -ml-1 transition-colors hover:bg-zinc-800/50"
                      onClick={() => setEditingTitle(true)}
                    >
                      {post.title || "Untitled Post"}
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingTitle(true)}
                      className="mt-1 rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-300"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <StatusBadge
                status={post.status}
                onStatusChange={
                  canManuallyToggleStatus
                    ? (newStatus) => {
                        if (
                          newStatus === "draft" ||
                          newStatus === "approved"
                        ) {
                          handleStatusChange(newStatus);
                        }
                      }
                    : undefined
                }
                allowedStatuses={canManuallyToggleStatus ? ["draft", "approved"] : undefined}
              />
            </DialogTitle>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Badge className="bg-zinc-800 text-[10px] text-zinc-300 hover:bg-zinc-800">
                {POST_TYPE_LABELS[post.postType] || post.postType}
              </Badge>
              {post.taskId && (
                <Badge
                  variant="outline"
                  className="border-violet-800 bg-violet-950/30 text-[10px] text-violet-400"
                >
                  <Zap className="mr-0.5 h-2.5 w-2.5" />
                  Task
                </Badge>
              )}
              <Badge
                variant="outline"
                className={`text-[10px] ${mode.className}`}
              >
                {mode.icon}
                {mode.label}
              </Badge>
              <span className="text-[10px] text-zinc-600">
                Created {new Date(post.createdAt).toLocaleString()}
              </span>
              {post.updatedAt !== post.createdAt && (
                <span className="text-[10px] text-zinc-600">
                  · Updated{" "}
                  {new Date(post.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="space-y-5 pb-2">
            {/* ── Section: Creative Brief ───────────────────────────── */}
            <div className="space-y-3">
              {(post.description || canEdit) && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Description
                    </p>
                    {canEdit && post.description && !editingDescription && (
                      <button
                        onClick={() => setEditingDescription(true)}
                        className="rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-300"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                  {canEdit && editingDescription ? (
                    <Textarea
                      value={post.description}
                      onChange={(e) => {
                        const updated = { ...post, description: e.target.value };
                        setPost(updated);
                        savePost(updated);
                      }}
                      onBlur={() => setEditingDescription(false)}
                      autoFocus
                      className="min-h-[60px] resize-y border-zinc-800 bg-zinc-900 text-sm text-zinc-300"
                    />
                  ) : post.description ? (
                    <p
                      className={`text-sm leading-relaxed text-zinc-300 ${canEdit ? "cursor-pointer rounded px-1 -mx-1 transition-colors hover:bg-zinc-800/50" : ""}`}
                      onClick={() => canEdit && setEditingDescription(true)}
                    >
                      {post.description}
                    </p>
                  ) : canEdit ? (
                    <button
                      onClick={() => setEditingDescription(true)}
                      className="text-xs text-zinc-600 hover:text-zinc-400"
                    >
                      + Add description
                    </button>
                  ) : null}
                </div>
              )}

              {(post.caption || canEdit) && !isReady && (
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Caption
                    </p>
                    <div className="flex items-center gap-2">
                      {canEdit && (
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setCaptionHelperOpen(true);
                          }}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-400 transition-colors hover:bg-violet-500/10 hover:text-violet-300"
                        >
                          <Sparkles className="h-3 w-3" />
                          <span>AI Helper</span>
                        </button>
                      )}
                      {canEdit && post.caption && !editingCaption && (
                        <button
                          onClick={() => setEditingCaption(true)}
                          className="rounded p-0.5 text-zinc-600 transition-colors hover:text-zinc-300"
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    {canEdit && editingCaption ? (
                      <Textarea
                        value={post.caption}
                        onChange={(e) => {
                          const updated = { ...post, caption: e.target.value };
                          setPost(updated);
                          setCaption(e.target.value);
                          savePost(updated);
                        }}
                        onBlur={() => setEditingCaption(false)}
                        autoFocus
                        className="min-h-[80px] resize-y border-zinc-800 bg-zinc-900 text-sm leading-6 text-zinc-200"
                      />
                    ) : post.caption ? (
                      <div
                        className={`min-h-[80px] rounded-md border border-zinc-800 bg-zinc-900 p-3 ${canEdit ? "cursor-pointer transition-colors hover:bg-zinc-800/70" : ""}`}
                        onClick={() => canEdit && setEditingCaption(true)}
                      >
                        <p className="whitespace-pre-line text-sm leading-6 text-zinc-200">
                          {post.caption}
                        </p>
                      </div>
                    ) : canEdit ? (
                      <button
                        onClick={() => setEditingCaption(true)}
                        className="w-full rounded-md border border-dashed border-zinc-800 bg-zinc-900 px-3 py-8 text-left text-xs text-zinc-600 transition-colors hover:border-zinc-700 hover:text-zinc-400"
                      >
                        + Add caption
                      </button>
                    ) : null}
                  </div>
                </div>
              )}

              {post.hashtags.length > 0 && !isReady && (
                <div className="flex flex-wrap gap-1.5">
                  {post.hashtags.map((tag, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-0.5 text-[11px] text-violet-400/80"
                    >
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
                    <div className="mt-1.5 rounded-md border border-zinc-800 bg-zinc-900 px-3 py-2">
                      <p className="text-xs leading-relaxed text-zinc-400">
                        {post.notes}
                      </p>
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}
            </div>

            {/* ── Section: Reference Images ─────────────────────────── */}
            {(showSourceImages || requiresReferenceSelection) && (
              <>
                <Separator className="bg-zinc-800" />
                <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                  <div className="flex gap-4">
                    {/* Source / Example images */}
                    {showSourceImages && (
                      <div className="min-w-0 flex-1">
                        <p className="mb-2 text-[10px] font-medium text-zinc-500">
                          {post.creationMode === "from_own_images"
                            ? "Your Image"
                            : "Example Post"}
                        </p>
                        <div className="flex gap-2">
                          {sourceImages.map((url, i) => (
                            <div
                              key={i}
                              className="group/src relative cursor-pointer"
                              onClick={() => setLightboxUrl(url)}
                            >
                              <img
                                src={url}
                                alt=""
                                className="h-20 w-20 rounded-md border border-zinc-700 object-cover"
                              />
                              <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/0 transition-colors group-hover/src:bg-black/40">
                                <ZoomIn className="h-4 w-4 text-white opacity-0 transition-opacity group-hover/src:opacity-100" />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Editable references */}
                    {requiresReferenceSelection && (
                      <div
                        className={`min-w-0 ${showSourceImages ? "border-l border-zinc-800 pl-4" : "flex-1"}`}
                      >
                        {/* Header row */}
                        <div className="mb-2 flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Wand2 className="h-2.5 w-2.5 text-zinc-500" />
                            <p className="text-[10px] font-medium text-zinc-500">
                              {referenceLabel}
                            </p>
                          </div>
                          {!isPosted && selectedRefs.length > 0 && selectedRefs.length < 10 && (
                            <button
                              onClick={() => setRefPickerOpen(true)}
                              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-violet-400 transition-colors hover:bg-violet-950/30 hover:text-violet-300"
                            >
                              <Library className="h-2.5 w-2.5" />
                              From Library
                            </button>
                          )}
                        </div>

                        {refLoading ? (
                          <div className="flex h-20 w-20 items-center justify-center rounded-md border border-dashed border-zinc-700 bg-zinc-900">
                            <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
                          </div>
                        ) : selectedRefs.length === 0 ? (
                          /* ── Empty state: two options ── */
                          <div className="flex gap-2">
                            <button
                              onClick={() => setRefPickerOpen(true)}
                              className="flex h-20 flex-1 items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-600 bg-zinc-900 text-[10px] text-zinc-500 transition-colors hover:border-violet-600 hover:text-violet-400"
                            >
                              <Library className="h-3.5 w-3.5" />
                              From Library
                            </button>
                            <label className="flex h-20 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed border-zinc-600 bg-zinc-900 text-[10px] text-zinc-500 transition-colors hover:border-violet-600 hover:text-violet-400">
                              <Upload className="h-3.5 w-3.5" />
                              Upload
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                className="hidden"
                                onChange={(e) => {
                                  const files = e.target.files;
                                  if (!files) return;
                                  Array.from(files).forEach((file) => {
                                    if (!file.type.startsWith("image/")) return;
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      const dataUri = ev.target?.result as string;
                                      if (dataUri) handleAddUploadedRef(dataUri);
                                    };
                                    reader.readAsDataURL(file);
                                  });
                                  e.target.value = "";
                                }}
                              />
                            </label>
                          </div>
                        ) : (
                          /* ── Populated state: thumbnails + upload drop zone ── */
                          <div className="flex flex-wrap items-end gap-2">
                            {selectedRefs.map((ref) => {
                              const isOwnSeedRef =
                                isOwnImageCarousel &&
                                ownImageReference?.url === ref.imagePath;

                              return (
                                <div
                                  key={ref.id}
                                  className="group/ref relative cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxUrl(getReferencePreviewPath(ref));
                                  }}
                                >
                                  <img
                                    src={ref.thumbnailPath || getReferencePreviewPath(ref)}
                                    alt={ref.summary || ""}
                                    className={`h-20 w-20 rounded-md border object-cover ${
                                      isOwnSeedRef
                                        ? "border-emerald-700/50"
                                        : "border-violet-700/50"
                                    }`}
                                  />
                                  {isOwnSeedRef && (
                                    <div className="absolute -bottom-1 -right-1 rounded bg-emerald-900/90 px-1 py-0.5 text-[7px] font-medium text-emerald-300">
                                      yours
                                    </div>
                                  )}
                                  {!isPosted && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveRef(ref.id);
                                      }}
                                      className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-800 text-zinc-400 opacity-0 shadow transition-opacity hover:bg-red-900 hover:text-red-300 group-hover/ref:opacity-100"
                                      title="Remove"
                                    >
                                      <X className="h-2.5 w-2.5" />
                                    </button>
                                  )}
                                </div>
                              );
                            })}

                            {/* Upload drop zone */}
                            {!isPosted && selectedRefs.length < 10 && (
                              <label
                                className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-zinc-700 bg-zinc-900 text-zinc-600 transition-colors hover:border-violet-600 hover:text-violet-400"
                                title="Upload or drop image"
                                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.add("border-violet-500", "bg-violet-950/20"); }}
                                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); e.currentTarget.classList.remove("border-violet-500", "bg-violet-950/20"); }}
                                onDrop={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  e.currentTarget.classList.remove("border-violet-500", "bg-violet-950/20");
                                  const files = e.dataTransfer.files;
                                  Array.from(files).forEach((file) => {
                                    if (!file.type.startsWith("image/")) return;
                                    const reader = new FileReader();
                                    reader.onload = (ev) => {
                                      const dataUri = ev.target?.result as string;
                                      if (dataUri) handleAddUploadedRef(dataUri);
                                    };
                                    reader.readAsDataURL(file);
                                  });
                                }}
                              >
                                <Upload className="h-4 w-4" />
                                <span className="text-[9px]">Upload</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  multiple
                                  className="hidden"
                                  onChange={(e) => {
                                    const files = e.target.files;
                                    if (!files) return;
                                    Array.from(files).forEach((file) => {
                                      if (!file.type.startsWith("image/")) return;
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const dataUri = ev.target?.result as string;
                                        if (dataUri) handleAddUploadedRef(dataUri);
                                      };
                                      reader.readAsDataURL(file);
                                    });
                                    e.target.value = "";
                                  }}
                                />
                              </label>
                            )}
                          </div>
                        )}
                        {selectedRefs.length === 0 && !refLoading && (
                          <p className="mt-1.5 text-[9px] text-amber-500/80">
                            {missingReferenceTitle}
                          </p>
                        )}
                        {isOwnImageCarousel && ownImageReference && (
                          <p className="mt-1.5 max-w-xs text-[9px] leading-relaxed text-zinc-500">
                            Prefilled from slide 1. You can remove it, replace it, or add more reference images before generating slides 2 and 3.
                          </p>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              </>
            )}

            {/* ── Section: Prompts & Images ─────────────────────────── */}
            {(post.imagePrompts.some((p) => p.prompt.trim()) || post.imagePrompts.length > 0) && (
              <>
                <Separator className="bg-zinc-800" />
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                      Prompts & Images
                    </p>
                    {canEdit && !promptEditMode && (
                      <button
                        onClick={() => setPromptEditMode(true)}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-zinc-500 transition-colors hover:bg-zinc-800 hover:text-zinc-300"
                      >
                        <Pencil className="h-2.5 w-2.5" />
                        Edit
                      </button>
                    )}
                    {canEdit && promptEditMode && (
                      <button
                        onClick={() => setPromptEditMode(false)}
                        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-violet-400 transition-colors hover:bg-violet-950/30 hover:text-violet-300"
                      >
                        <Check className="h-2.5 w-2.5" />
                        Done
                      </button>
                    )}
                  </div>

                  {editingPrompts.map((promptData, i) => {
                    const generatedImage = post.generatedImages.find(
                      (g) => g.promptIndex === i && g.selected
                    );
                    const isUserProvided = generatedImage?.userProvided;
                    // During generation, the first slide without an image is the one currently being generated
                    const isCurrentlyGenerating = isGenerating && !generatedImage && !isUserProvided &&
                      !editingPrompts.some((_, j) => j < i && !post.generatedImages.find((g) => g.promptIndex === j && g.selected) && !post.generatedImages.find((g) => g.promptIndex === j && g.userProvided));

                    if (isUserProvided) {
                      return (
                        <div
                          key={i}
                          className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/50"
                        >
                          <div className="flex gap-3 p-3">
                            <div className="w-28 shrink-0">
                              <div
                                className="group/img relative cursor-pointer overflow-hidden rounded-md border border-zinc-700"
                                onClick={() =>
                                  generatedImage &&
                                  setLightboxUrl(generatedImage.url)
                                }
                              >
                                <img
                                  src={generatedImage!.url}
                                  alt=""
                                  className="aspect-square w-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/img:bg-black/30">
                                  <ZoomIn className="h-5 w-5 text-white opacity-0 transition-opacity group-hover/img:opacity-100" />
                                </div>
                                <div className="absolute bottom-1 left-1 rounded bg-emerald-900/80 px-1 py-0.5 text-[8px] text-emerald-300">
                                  yours
                                </div>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-2 pt-0.5">
                              <p className="text-[10px] font-medium text-zinc-500">
                                {editingPrompts.length > 1
                                  ? `Slide ${i + 1}`
                                  : "Your Photo"}
                              </p>
                              <p className="text-xs italic text-zinc-500">
                                {isManualPost
                                  ? `Manual upload${editingPrompts.length > 1 ? ` — used as slide ${i + 1}` : ""}`
                                  : <>Your original photo — used as slide{" "}{i + 1}</>}
                              </p>
                              {post.status === "ready" && (
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => handleRegenerateSlide(i)}
                                    disabled={actions.isGenerating}
                                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-amber-400 transition-colors hover:bg-amber-950/30 hover:text-amber-300 disabled:opacity-50"
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" />
                                    Regenerate
                                  </button>
                                </div>
                              )}
                              {isManualPost && promptEditMode && (
                                <div className="flex items-center gap-1.5">
                                  <label className="cursor-pointer rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:border-violet-600 hover:text-violet-300">
                                    Replace
                                    <input
                                      type="file"
                                      accept="image/*"
                                      className="hidden"
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (!file || !file.type.startsWith("image/")) return;
                                        const reader = new FileReader();
                                        reader.onload = (ev) => {
                                          const dataUri = ev.target?.result as string;
                                          if (dataUri) handleManualImageUpload(i, dataUri);
                                        };
                                        reader.readAsDataURL(file);
                                        e.target.value = "";
                                      }}
                                    />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveManualImage(i)}
                                    className="rounded border border-zinc-700 px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:border-red-800 hover:text-red-300"
                                  >
                                    Remove
                                  </button>
                                </div>
                              )}
                              {promptData.referenceImageAnalysis && (
                                <Collapsible>
                                  <CollapsibleTrigger className="flex items-center gap-1 text-[9px] font-medium text-zinc-600 hover:text-zinc-500">
                                    <ChevronRight className="h-2.5 w-2.5 transition-transform [[data-state=open]>&]:rotate-90" />
                                    AI Analysis
                                  </CollapsibleTrigger>
                                  <CollapsibleContent>
                                    <div className="mt-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5">
                                      <p className="text-[10px] leading-relaxed text-zinc-500">
                                        {promptData.referenceImageAnalysis}
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

                    if (!promptData.prompt.trim() && !promptEditMode && !isManualPost) {
                      return null;
                    }

                    return (
                      <div
                        key={i}
                        className="overflow-hidden rounded-md border border-zinc-800 bg-zinc-900/50"
                      >
                        <div className="flex gap-3 p-3">
                          {/* Left: Image slot */}
                          <div className="w-28 shrink-0">
                            {generatedImage ? (
                              <div
                                className="group/img relative cursor-pointer overflow-hidden rounded-md border border-zinc-700"
                                onClick={() =>
                                  setLightboxUrl(generatedImage.url)
                                }
                              >
                                <img
                                  src={generatedImage.url}
                                  alt=""
                                  className="aspect-square w-full object-cover"
                                />
                                <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover/img:bg-black/30">
                                  <ZoomIn className="h-5 w-5 text-white opacity-0 transition-opacity group-hover/img:opacity-100" />
                                </div>
                              </div>
                            ) : (
                              isManualPost && canEdit ? (
                                <label className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-zinc-700 bg-zinc-900 text-zinc-600 transition-colors hover:border-violet-600 hover:text-violet-400">
                                  <Upload className="h-5 w-5" />
                                  <span className="mt-1 text-[8px]">Upload</span>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (!file || !file.type.startsWith("image/")) return;
                                      const reader = new FileReader();
                                      reader.onload = (ev) => {
                                        const dataUri = ev.target?.result as string;
                                        if (dataUri) handleManualImageUpload(i, dataUri);
                                      };
                                      reader.readAsDataURL(file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              ) : (
                                <div className={`flex aspect-square w-full flex-col items-center justify-center rounded-md border bg-zinc-900 ${
                                  isCurrentlyGenerating
                                    ? "border-violet-600/50 bg-violet-950/20"
                                    : "border-dashed border-zinc-700"
                                }`}>
                                  {isCurrentlyGenerating ? (
                                    <>
                                      <Loader2 className="h-5 w-5 animate-spin text-violet-400" />
                                      <span className="mt-1 text-[8px] text-violet-400">Generating...</span>
                                    </>
                                  ) : isGenerating ? (
                                    <span className="text-[8px] text-zinc-600">Waiting...</span>
                                  ) : (
                                    <ImageIcon className="h-5 w-5 text-zinc-700" />
                                  )}
                                </div>
                              )
                            )}
                          </div>

                          {/* Right: Prompt + controls */}
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="text-[10px] font-medium text-zinc-500">
                                {editingPrompts.length > 1
                                  ? `Slide ${i + 1}`
                                  : "Image Prompt"}
                              </p>
                              <div className="flex items-center gap-1">
                                {promptEditMode && (
                                  <button
                                    onClick={() => {
                                      setPromptHelperIndex(i);
                                      setPromptHelperOpen(true);
                                    }}
                                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-violet-400 transition-colors hover:bg-violet-950/30 hover:text-violet-300"
                                  >
                                    <Wand2 className="h-2.5 w-2.5" />
                                    Helper
                                  </button>
                                )}
                                {post.status === "ready" && (
                                  <button
                                    onClick={() =>
                                      handleRegenerateSlide(i)
                                    }
                                    disabled={actions.isGenerating}
                                    className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] text-amber-400 transition-colors hover:bg-amber-950/30 hover:text-amber-300 disabled:opacity-50"
                                  >
                                    <RefreshCw className="h-2.5 w-2.5" />
                                    Regenerate
                                  </button>
                                )}
                              </div>
                            </div>

                            {promptEditMode ? (
                              <Textarea
                                value={promptData.prompt}
                                onChange={(e) =>
                                  handlePromptChange(i, e.target.value)
                                }
                                placeholder="Describe what to generate. Use Figure 1, Figure 2 for reference images."
                                className="min-h-[60px] resize-y border-zinc-800 bg-zinc-900 font-mono text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600"
                              />
                            ) : (
                              <p className="font-mono text-xs leading-relaxed text-zinc-200">
                                {promptData.prompt || <span className="text-zinc-600 italic">No prompt</span>}
                              </p>
                            )}

                            {/* Reference image analysis */}
                            {promptData.referenceImageAnalysis && (
                              <Collapsible>
                                <CollapsibleTrigger className="flex items-center gap-1 text-[9px] font-medium text-zinc-600 hover:text-zinc-500">
                                  <ChevronRight className="h-2.5 w-2.5 transition-transform [[data-state=open]>&]:rotate-90" />
                                  Reference Analysis
                                </CollapsibleTrigger>
                                <CollapsibleContent>
                                  <div className="mt-1 rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5">
                                    <p className="text-[10px] leading-relaxed text-zinc-500">
                                      {promptData.referenceImageAnalysis}
                                    </p>
                                  </div>
                                </CollapsibleContent>
                              </Collapsible>
                            )}

                            {/* Per-prompt reference images (editable in edit mode) */}
                            {promptEditMode &&
                              promptData.referenceImages.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                  {promptData.referenceImages.map(
                                    (img, ri) => (
                                      <div
                                        key={ri}
                                        className="group relative"
                                      >
                                        <img
                                          src={img}
                                          alt=""
                                          className="h-10 w-10 rounded object-cover"
                                        />
                                        <button
                                          onClick={() => {
                                            const newRefs =
                                              promptData.referenceImages.filter(
                                                (_, idx) => idx !== ri
                                              );
                                            handlePromptRefImagesChange(
                                              i,
                                              newRefs
                                            );
                                          }}
                                          className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-white opacity-0 transition-opacity group-hover:opacity-100"
                                        >
                                          <X className="h-2 w-2" />
                                        </button>
                                      </div>
                                    )
                                  )}
                                </div>
                              )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {isGenerating && (
                    <div className="flex items-center gap-2 text-xs text-amber-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating images…
                    </div>
                  )}

                  {/* Generation settings (collapsible, only for draft/approved) */}
                  {(isDraft || isApproved) && (
                    <Collapsible
                      open={genSettingsOpen}
                      onOpenChange={setGenSettingsOpen}
                    >
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-400">
                        <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
                        Generation Settings
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2">
                          <GenerationControls
                            settings={genSettings}
                            onChange={setGenSettings}
                          />
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}

                </div>
              </>
            )}

            {/* ── Section: Review & Edit (ready state) ──────────────── */}
            {isReady && !isPosted && (
              <>
                <Separator className="bg-zinc-800" />
                <div className="space-y-3">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    Review & Edit
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    {/* Left: Instagram Preview */}
                    <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-3">
                      <InstagramPreview
                        post={{
                          ...post,
                          caption,
                          hashtags: hashtagsText
                            .split(",")
                            .map((t) => t.trim().replace(/^#/, ""))
                            .filter(Boolean),
                        }}
                        account={instagram.account}
                      />
                    </div>

                    {/* Right: Edit panel */}
                    <div className="space-y-3">
                      {/* Image reorder + pool */}
                      {post.generatedImages.length > 1 && (
                        <div>
                          <p className="mb-1.5 text-[10px] font-medium text-zinc-500">
                            Image Order{" "}
                            <span className="text-zinc-600">
                              · drag to reorder
                            </span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {/* Selected images */}
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
                                <img
                                  src={img.url}
                                  alt=""
                                  className="aspect-square w-full cursor-zoom-in object-cover"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setLightboxUrl(img.url);
                                  }}
                                />
                                <div className="absolute left-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600 text-[8px] font-semibold text-white">
                                  {index + 1}
                                </div>
                                <button
                                  className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-600 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleSelect(img.id);
                                  }}
                                  title="Remove from selection"
                                >
                                  <X className="h-2 w-2" />
                                </button>
                              </div>
                            ))}
                            {/* Unselected images */}
                            {post.generatedImages
                              .filter((img) => !img.selected)
                              .map((img) => (
                                <div
                                  key={img.id}
                                  className="group relative shrink-0 cursor-zoom-in overflow-hidden rounded-md border-2 border-zinc-700 bg-zinc-900 opacity-50 hover:opacity-80"
                                  style={{ width: "64px" }}
                                >
                                  <img
                                    src={img.url}
                                    alt=""
                                    className="aspect-square w-full object-cover"
                                    onClick={() => setLightboxUrl(img.url)}
                                  />
                                  <button
                                    className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-violet-600 text-white opacity-0 shadow transition-opacity group-hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleSelect(img.id);
                                    }}
                                    title="Add to selection"
                                  >
                                    <Plus className="h-2 w-2" />
                                  </button>
                                </div>
                              ))}
                          </div>
                        </div>
                      )}

                      {/* Caption */}
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <label className="text-[10px] font-medium text-zinc-500">
                            Caption
                          </label>
                          <button
                            type="button"
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setCaptionHelperOpen(true);
                            }}
                            className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-violet-400 transition-colors hover:bg-violet-500/10 hover:text-violet-300"
                          >
                            <Sparkles className="h-3 w-3" />
                            <span>AI Helper</span>
                          </button>
                        </div>
                        <div>
                          <Textarea
                            value={caption}
                            onChange={(e) => {
                              setCaption(e.target.value);
                              setCaptionDirty(true);
                            }}
                            className="min-h-[100px] resize-none border-zinc-800 bg-zinc-900 text-xs leading-5 text-zinc-100"
                            placeholder="Instagram caption"
                          />
                        </div>
                      </div>

                      {/* Hashtags */}
                      <div>
                        <label className="text-[10px] font-medium text-zinc-500">
                          Hashtags
                        </label>
                        <Input
                          value={hashtagsText}
                          onChange={(e) => {
                            setHashtagsText(e.target.value);
                            setCaptionDirty(true);
                          }}
                          className="mt-0.5 h-8 border-zinc-800 bg-zinc-900 text-xs"
                          placeholder="tag1, tag2, tag3"
                        />
                        <p className="mt-0.5 text-[9px] text-zinc-600">
                          Comma-separated, # optional
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* All generated images */}
                  {post.generatedImages.length > 0 && (
                    <Collapsible>
                      <CollapsibleTrigger className="flex items-center gap-1.5 text-[10px] font-medium text-zinc-500 hover:text-zinc-400">
                        <ChevronRight className="h-3 w-3 transition-transform [[data-state=open]>&]:rotate-90" />
                        All Generated Images (
                        {post.generatedImages.length})
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 grid grid-cols-6 gap-2">
                          {post.generatedImages.map((img) => (
                            <div
                              key={img.id}
                              className="group relative cursor-zoom-in"
                              onClick={() => setLightboxUrl(img.url)}
                            >
                              <img
                                src={img.url}
                                alt=""
                                className={`aspect-square w-full rounded-md object-cover border-2 ${
                                  img.selected
                                    ? "border-violet-500"
                                    : "border-transparent"
                                }`}
                              />
                              {img.selected && (
                                <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-violet-600">
                                  <Check className="h-2.5 w-2.5 text-white" />
                                </div>
                              )}
                              {img.userProvided && (
                                <div className="absolute bottom-1 left-1 rounded bg-emerald-900/80 px-1 py-0.5 text-[7px] text-emerald-300">
                                  yours
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </div>
              </>
            )}

            {/* ── Section: Publishing ───────────────────────────────── */}
            {post.status === "ready" &&
              !actions.isPublishing && (
                <>
                  <Separator className="bg-zinc-800" />
                  <div className="rounded-lg border border-zinc-800 bg-zinc-900/30 p-4">
                    <h3 className="mb-3 text-xs font-medium text-zinc-400">
                      Publish Settings
                    </h3>

                    {/* Schedule toggle */}
                    <div className="flex items-center justify-between rounded-md bg-zinc-900/50 p-3">
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-zinc-400" />
                        <span className="text-sm text-zinc-300">
                          Schedule for later
                        </span>
                      </div>
                      <Switch
                        checked={isScheduled}
                        onCheckedChange={setIsScheduled}
                      />
                    </div>

                    {isScheduled && (
                      <div className="mt-3 space-y-2 rounded-md border border-zinc-800 bg-zinc-900/30 p-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] font-medium text-zinc-500">
                              Date
                            </label>
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="mt-1 w-full justify-start border-zinc-700 text-left text-xs font-normal"
                                >
                                  <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                                  {scheduledDate
                                    ? scheduledDate.toLocaleDateString()
                                    : "Pick a date"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent
                                className="w-auto p-0"
                                align="start"
                              >
                                <Calendar
                                  mode="single"
                                  selected={scheduledDate}
                                  onSelect={setScheduledDate}
                                  disabled={(date) => {
                                    const today = new Date();
                                    today.setHours(0, 0, 0, 0);
                                    const maxDate = new Date();
                                    maxDate.setDate(
                                      maxDate.getDate() + 75
                                    );
                                    return (
                                      date < today || date > maxDate
                                    );
                                  }}
                                />
                              </PopoverContent>
                            </Popover>
                          </div>
                          <div className="w-28">
                            <label className="text-[10px] font-medium text-zinc-500">
                              Time
                            </label>
                            <Input
                              type="time"
                              value={scheduledTime}
                              onChange={(e) =>
                                setScheduledTime(e.target.value)
                              }
                              className="mt-1 h-9 border-zinc-700 text-xs"
                            />
                          </div>
                        </div>
                        <p className="text-[10px] text-zinc-600">
                          Min 10 min from now, max 75 days.{" "}
                          {
                            Intl.DateTimeFormat().resolvedOptions()
                              .timeZone
                          }
                        </p>
                      </div>
                    )}

                    {/* Validation errors */}
                    {(captionTooLong || tooManyHashtags) && (
                      <div className="mt-3 space-y-1">
                        {captionTooLong && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400">
                            <AlertCircle className="h-3 w-3" />
                            Caption + hashtags exceed 2,200 characters (
                            {fullCaption.length})
                          </div>
                        )}
                        {tooManyHashtags && (
                          <div className="flex items-center gap-1.5 text-xs text-red-400">
                            <AlertCircle className="h-3 w-3" />
                            Maximum 30 hashtags ({post.hashtags.length})
                          </div>
                        )}
                      </div>
                    )}

                    {/* Account status */}
                    <div className="mt-3">
                      <AccountStatus
                        account={instagram.account}
                        loading={instagram.loading}
                        onConnect={instagram.connect}
                        onDisconnect={instagram.disconnect}
                        onRefreshToken={instagram.refreshToken}
                      />
                    </div>
                  </div>
                </>
              )}

            {/* Publishing progress */}
            {(post.status === "publishing" || actions.isPublishing) && (
              <>
                <Separator className="bg-zinc-800" />
                <PublishProgress
                  post={post}
                  isPublishing={actions.isPublishing}
                  onRetry={() => {
                    if (post) {
                      const reset = {
                        ...post,
                        status: "ready" as const,
                        publishingInfo: { status: "idle" as const },
                      };
                      savePost(reset);
                      setPost(reset);
                    }
                  }}
                  onReconnect={instagram.connect}
                />
              </>
            )}

            {/* ── Section: Published Info ───────────────────────────── */}
            {isPosted && post.publishingInfo && (
              <>
                <Separator className="bg-zinc-800" />
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">
                    {post.status === "scheduled"
                      ? "Scheduled"
                      : "Published"}
                  </p>
                  {post.publishingInfo.publishedAt && (
                    <p className="text-xs text-zinc-400">
                      {new Date(
                        post.publishingInfo.publishedAt
                      ).toLocaleString()}
                    </p>
                  )}
                  {post.publishingInfo.scheduledFor && (
                    <p className="text-xs text-zinc-400">
                      Scheduled for{" "}
                      {new Date(
                        post.publishingInfo.scheduledFor
                      ).toLocaleString()}
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
            <div className="flex items-center justify-between">
              <div>
                {!isPosted && (
                  <>
                    {deleteConfirm ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400">
                          Delete this post?
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDeletePost}
                          className="h-7 border-red-800 text-xs text-red-400 hover:bg-red-950/30"
                        >
                          Confirm
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setDeleteConfirm(false)}
                          className="h-7 border-zinc-700 text-xs text-zinc-400"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setDeleteConfirm(true)}
                        className="h-7 text-xs text-zinc-600 hover:text-red-400"
                      >
                        <Trash2 className="mr-1 h-3 w-3" />
                        Delete
                      </Button>
                    )}
                  </>
                )}
              </div>

              <div className="flex items-center gap-2">
                {isDraft && (
                  <Button
                    onClick={handleApproveAndGenerate}
                    disabled={actions.isGenerating || (requiresReferenceSelection && selectedRefs.length === 0)}
                    title={requiresReferenceSelection && selectedRefs.length === 0 ? missingReferenceTitle : undefined}
                    className="bg-violet-600 text-white hover:bg-violet-700"
                  >
                    <Check className="mr-1.5 h-4 w-4" />
                    Approve & Generate
                  </Button>
                )}
                {isApproved && (
                  <Button
                    onClick={handleApproveAndGenerate}
                    disabled={actions.isGenerating || (requiresReferenceSelection && selectedRefs.length === 0)}
                    title={requiresReferenceSelection && selectedRefs.length === 0 ? missingReferenceTitle : undefined}
                    className="bg-violet-600 text-white hover:bg-violet-700"
                  >
                    <Sparkles className="mr-1.5 h-4 w-4" />
                    Start Generation
                  </Button>
                )}
                {isGenerating && (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleStopGeneration}
                      className="border-red-800 text-red-400 hover:bg-red-950/30 hover:text-red-300"
                    >
                      <Square className="mr-1.5 h-3.5 w-3.5 fill-current" />
                      Stop
                    </Button>
                    <Button
                      disabled
                      className="bg-zinc-800 text-zinc-400"
                    >
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Generating…
                    </Button>
                  </>
                )}
                {post.status === "ready" && (
                  <Button
                    onClick={handlePublish}
                    disabled={!canPublishNow}
                    className="bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Send className="mr-1.5 h-4 w-4" />
                    {isScheduled && scheduledDate
                      ? `Schedule for ${scheduledDate.toLocaleDateString()}`
                      : "Publish to Instagram"}
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
          </div>
        </DialogContent>
      </Dialog>

      {/* Character reference library picker */}
      <ReferenceLibraryDialog
        open={refPickerOpen}
        onOpenChange={setRefPickerOpen}
        onImagesSelected={handleRefLibrarySelected}
      />

      {/* Prompt Helper Dialog */}
      {promptHelperIndex !== null && (
        <PromptHelperDialog
          open={promptHelperOpen}
          onOpenChange={setPromptHelperOpen}
          currentPrompt={editingPrompts[promptHelperIndex]?.prompt || ""}
          referenceImages={
            editingPrompts[promptHelperIndex]?.referenceImages || []
          }
          onApplyPrompt={(prompt) => {
            handlePromptChange(promptHelperIndex, prompt);
          }}
        />
      )}

      {/* Caption Helper Dialog */}
      <CaptionHelperDialog
        open={captionHelperOpen}
        onOpenChange={setCaptionHelperOpen}
        currentCaption={isReady ? caption : post.caption}
        imageUrls={captionHelperImageUrls}
        onApplyCaption={applyCaptionToPost}
      />

      {/* Image lightbox — rendered via portal outside Dialog */}
      {lightboxUrl &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/85 backdrop-blur-sm"
            onClick={() => setLightboxUrl(null)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxUrl(null);
              }}
              className="absolute right-4 top-4 rounded-full bg-zinc-800/80 p-2 text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
            <img
              src={lightboxUrl}
              alt=""
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
          </div>,
          document.body
        )}
    </>
  );
}
