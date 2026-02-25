"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PostPlan, GeneratedImage, ImagePrompt } from "@/lib/types";
import { savePost } from "@/lib/store";
import { checkDailyLimit, recordGeneration } from "@/lib/cost-tracker";
import { ReferenceUploader } from "./ReferenceUploader";
import {
  GenerationControls,
  GenerationControlsSettings,
} from "./GenerationControls";
import { ResultsGallery } from "./ResultsGallery";
import { PromptHelperDialog } from "./PromptHelperDialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Sparkles,
  FileText,
  AlertCircle,
  Save,
  Plus,
  Eye,
  Wand2,
  Lock,
  ImageIcon,
} from "lucide-react";
import Image from "next/image";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface GenerationWorkspaceProps {
  post: PostPlan;
  onPostUpdate: (post: PostPlan) => void;
}

export function GenerationWorkspace({
  post,
  onPostUpdate,
}: GenerationWorkspaceProps) {
  const [activeTab, setActiveTab] = useState("0");
  const [imagePrompts, setImagePrompts] = useState<ImagePrompt[]>(
    post.imagePrompts
  );
  const [settings, setSettings] = useState<GenerationControlsSettings>({
    imageSize: "portrait_4_3",
    numVariations: 1,
    seed: "",
    maxImages: 1,
    enableSafetyChecker: true,
  });
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingTab, setGeneratingTab] = useState<number | null>(null);
  const [isContextOpen, setIsContextOpen] = useState(false);
  const [editableTitle, setEditableTitle] = useState(post.title);
  const [editableDescription, setEditableDescription] = useState(
    post.description
  );
  const [expandedAnalysis, setExpandedAnalysis] = useState<
    Record<number, boolean>
  >({});
  const [promptHelperOpen, setPromptHelperOpen] = useState(false);
  const [promptHelperTabIndex, setPromptHelperTabIndex] = useState<
    number | null
  >(null);

  const isMissingInfo = !post.title || !post.caption;
  const isCarousel = post.postType === "carousel";

  // ─── Prompt management ─────────────────────────────────────────────────

  const updatePrompt = (index: number, updates: Partial<ImagePrompt>) => {
    const updated = [...imagePrompts];
    updated[index] = { ...updated[index], ...updates };
    setImagePrompts(updated);

    // Also persist to post immediately
    const updatedPost = { ...post, imagePrompts: updated };
    savePost(updatedPost);
    onPostUpdate(updatedPost);
  };

  const addNewPrompt = () => {
    const newPrompts = [
      ...imagePrompts,
      { prompt: "", referenceImages: [] },
    ];
    setImagePrompts(newPrompts);
    setActiveTab(String(newPrompts.length - 1));

    const updatedPost = { ...post, imagePrompts: newPrompts };
    savePost(updatedPost);
    onPostUpdate(updatedPost);
  };

  const openPromptHelper = (tabIndex: number) => {
    setPromptHelperTabIndex(tabIndex);
    setPromptHelperOpen(true);
  };

  const handleApplyPrompt = (prompt: string) => {
    if (promptHelperTabIndex !== null) {
      updatePrompt(promptHelperTabIndex, { prompt });
    }
  };

  // ─── Metadata ─────────────────────────────────────────────────────────

  const handleSaveMetadata = () => {
    const updatedPost: PostPlan = {
      ...post,
      title: editableTitle,
      description: editableDescription,
    };
    savePost(updatedPost);
    onPostUpdate(updatedPost);
  };

  // ─── Generation ───────────────────────────────────────────────────────

  const handleGenerate = async (tabIndex: number) => {
    const promptData = imagePrompts[tabIndex];
    if (!promptData.prompt.trim()) {
      toast.warning("Please enter a prompt");
      return;
    }
    if (promptData.referenceImages.length === 0) {
      toast.warning("Please upload at least one reference image");
      return;
    }

    // Check cost limits before proceeding
    const costCheck = checkDailyLimit();
    if (!costCheck.allowed) {
      toast.error(
        `Daily spend limit reached (€${costCheck.dailySpend.toFixed(2)} / €${costCheck.dailyStopLimit.toFixed(2)}). Adjust in Settings.`
      );
      return;
    }
    if (costCheck.warning) {
      toast.warning(
        `Approaching daily limit (€${costCheck.dailySpend.toFixed(2)} / €${costCheck.dailyStopLimit.toFixed(2)})`
      );
    }

    setIsGenerating(true);
    setGeneratingTab(tabIndex);

    // Mark the post as "generating" so the sidebar reflects it
    // but don't downgrade from "ready" — confirmed selections persist
    if (post.status !== "generating" && post.status !== "ready") {
      const inProgressPost: PostPlan = { ...post, status: "generating" };
      savePost(inProgressPost);
      onPostUpdate(inProgressPost);
    }

    try {
      // Upload reference images first
      const uploadedUrls: string[] = [];
      for (const img of promptData.referenceImages) {
        const uploadResp = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUri: img }),
        });
        const uploadData = await uploadResp.json();
        if (uploadData.error) {
          uploadedUrls.push(img);
        } else {
          uploadedUrls.push(uploadData.url);
        }
      }

      // Generate images for each variation
      const allNewImages: GeneratedImage[] = [];

      for (let v = 0; v < settings.numVariations; v++) {
        const resp = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: promptData.prompt,
            imageUrls: uploadedUrls,
            imageSize: settings.imageSize,
            numImages: 1,
            maxImages: settings.maxImages,
            seed: settings.seed ? parseInt(settings.seed) + v : undefined,
            enableSafetyChecker: settings.enableSafetyChecker,
          }),
        });

        const data = await resp.json();
        if (data.error) {
          throw new Error(data.error);
        }

        // Record cost for this generation call
        recordGeneration();

        if (data.images) {
          for (const img of data.images) {
            // Use seed from API response if available, otherwise use the specified seed
            const actualSeed = img.seed || (settings.seed ? parseInt(settings.seed) + v : undefined);

            allNewImages.push({
              id: crypto.randomUUID(),
              url: img.url,
              prompt: promptData.prompt,
              seed: actualSeed,
              settings: {
                imageSize: settings.imageSize,
                seed: actualSeed,
                numImages: settings.maxImages,
                numVariations: settings.numVariations,
                enableSafetyChecker: settings.enableSafetyChecker,
              },
              selected: false,
              createdAt: new Date().toISOString(),
              promptIndex: tabIndex,
            });
          }
        }
      }

      // Auto-cascade: if this is tab 1 of a carousel, add the latest generated
      // image as a reference to all subsequent tabs for visual consistency
      let updatedPrompts = imagePrompts;
      if (isCarousel && tabIndex === 0 && allNewImages.length > 0) {
        const latestImageUrl = allNewImages[0].url;
        updatedPrompts = imagePrompts.map((p, idx) => {
          if (idx <= 0) return p;
          if (p.referenceImages.includes(latestImageUrl)) return p;
          return { ...p, referenceImages: [...p.referenceImages, latestImageUrl] };
        });
        setImagePrompts(updatedPrompts);
        toast.info("Reference image from Image 1 auto-added to subsequent slides");
      }

      // Save to post — preserve "ready" status if already confirmed
      const newStatus = post.status === "ready" ? "ready" : "generating";
      const updatedPost: PostPlan = {
        ...post,
        imagePrompts: updatedPrompts,
        generatedImages: [...allNewImages, ...(post.generatedImages || [])],
        status: newStatus,
      };
      savePost(updatedPost);
      onPostUpdate(updatedPost);

      const count = allNewImages.length;
      toast.success(`Generated ${count} image${count > 1 ? "s" : ""}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setIsGenerating(false);
      setGeneratingTab(null);
    }
  };

  // ─── Results ──────────────────────────────────────────────────────────

  const handleToggleSelect = (imageId: string) => {
    const updated = post.generatedImages.map((img) =>
      img.id === imageId ? { ...img, selected: !img.selected } : img
    );
    const updatedPost = { ...post, generatedImages: updated };
    savePost(updatedPost);
    onPostUpdate(updatedPost);
  };

  const handleIterate = async (image: GeneratedImage) => {
    const tabIndex = image.promptIndex ?? 0;
    
    // Add this image to the reference images for that tab
    const currentPrompt = imagePrompts[tabIndex];
    const updatedRefs = [...currentPrompt.referenceImages, image.url];
    
    updatePrompt(tabIndex, { referenceImages: updatedRefs });
    
    // Switch to that tab so user can see it was added
    setActiveTab(String(tabIndex));
  };

  const handleConfirmImages = () => {
    const selected = post.generatedImages.filter((i) => i.selected);
    if (selected.length === 0) return;

    const updatedPost: PostPlan = {
      ...post,
      status: "ready",
    };
    savePost(updatedPost);
    onPostUpdate(updatedPost);

    toast.success(`${selected.length} image${selected.length > 1 ? 's' : ''} confirmed — post is ready!`);
  };

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col">
      {/* Post context */}
      <Collapsible
        open={isContextOpen || isMissingInfo}
        onOpenChange={setIsContextOpen}
      >
        <div className="border-b border-zinc-800 px-5 py-3">
          <CollapsibleTrigger className="flex w-full items-center gap-2">
            {isContextOpen ? (
              <ChevronDown className="h-3 w-3 text-zinc-500" />
            ) : (
              <ChevronRight className="h-3 w-3 text-zinc-500" />
            )}
            <FileText className="h-3.5 w-3.5 text-zinc-500" />
            <span className="flex-1 truncate text-left text-sm font-medium text-zinc-200">
              {post.title || "Untitled Post"}
            </span>
            {isMissingInfo && (
              <Badge
                variant="outline"
                className="border-amber-700 bg-amber-950/30 text-[9px] text-amber-400"
              >
                <AlertCircle className="mr-1 h-2.5 w-2.5" />
                Missing info
              </Badge>
            )}
            <Badge
              variant="outline"
              className="border-zinc-700 text-[9px] text-zinc-400"
            >
              {post.postType.replace("_", " ")}
            </Badge>
          </CollapsibleTrigger>

          <CollapsibleContent className="mt-3 space-y-3">
            {/* Editable title */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500">
                Title
              </label>
              <Input
                value={editableTitle}
                onChange={(e) => setEditableTitle(e.target.value)}
                placeholder="Add a title for this post..."
                className="border-zinc-800 bg-zinc-900 text-xs text-zinc-100"
              />
            </div>

            {/* Editable description */}
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500">
                Description
              </label>
              <Textarea
                value={editableDescription}
                onChange={(e) => setEditableDescription(e.target.value)}
                placeholder="Describe what this post is about..."
                className="min-h-[60px] resize-none border-zinc-800 bg-zinc-900 text-xs text-zinc-100"
              />
            </div>

            {/* Caption preview */}
            {post.caption && (
              <div className="space-y-1">
                <label className="text-[10px] font-medium text-zinc-500">
                  Caption Preview
                </label>
                <p className="rounded-md bg-zinc-800/50 px-3 py-2 text-xs leading-relaxed text-zinc-400">
                  {post.caption.slice(0, 150)}
                  {post.caption.length > 150 && "..."}
                </p>
              </div>
            )}

            {/* Save metadata button */}
            {(editableTitle !== post.title ||
              editableDescription !== post.description) && (
              <Button
                size="sm"
                variant="outline"
                onClick={handleSaveMetadata}
                className="border-zinc-700 text-xs text-zinc-300"
              >
                <Save className="mr-1 h-3 w-3" />
                Save changes
              </Button>
            )}
          </CollapsibleContent>
        </div>
      </Collapsible>

      {/* Workspace content */}
      <div className="flex-1 overflow-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full">
          {/* Tab headers */}
          <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950 px-5 pt-4">
            <div className="flex items-center gap-2">
              <TabsList className="bg-zinc-900">
                {imagePrompts.map((_, i) => {
                  const isUserProvided = post.generatedImages?.some(
                    (img) => img.userProvided && img.promptIndex === i
                  );
                  return (
                    <TabsTrigger
                      key={i}
                      value={String(i)}
                      className="relative text-xs"
                    >
                      {isUserProvided && <Lock className="mr-1 h-3 w-3 text-emerald-400" />}
                      Image {i + 1}
                      {generatingTab === i && (
                        <span className="ml-1.5 flex h-1.5 w-1.5">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75"></span>
                          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-500"></span>
                        </span>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>
              <Button
                size="sm"
                variant="ghost"
                onClick={addNewPrompt}
                className="h-8 gap-1 text-xs text-zinc-400 hover:text-zinc-200"
              >
                <Plus className="h-3 w-3" />
                Add Image
              </Button>
            </div>
          </div>

          {/* Tab contents */}
          {imagePrompts.map((promptData, i) => {
            // Check if this tab has a user-provided image (locked, no generation needed)
            const userProvidedImage = post.generatedImages?.find(
              (img) => img.userProvided && img.promptIndex === i
            );

            return (
              <TabsContent
                key={i}
                value={String(i)}
                className="mt-0 p-5 data-[state=inactive]:hidden"
              >
                {userProvidedImage ? (
                  /* ─── Locked user-provided image tab ─── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-md border border-emerald-800/50 bg-emerald-950/20 px-3 py-2">
                      <Lock className="h-4 w-4 text-emerald-400" />
                      <span className="text-sm font-medium text-emerald-300">
                        Your image
                      </span>
                      <span className="text-xs text-zinc-500">
                        — This is your uploaded image. It will be used as slide {i + 1} of the carousel.
                      </span>
                    </div>
                    <div className="flex justify-center">
                      <div className="relative max-w-md overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
                        <Image
                          src={userProvidedImage.url}
                          alt="Your uploaded image"
                          width={400}
                          height={400}
                          className="object-contain"
                        />
                      </div>
                    </div>
                    <p className="text-center text-xs text-zinc-500">
                      Generate companion images in the other tabs to complete your carousel.
                    </p>
                  </div>
                ) : (
                  /* ─── Normal generation tab ─── */
                  <div className="space-y-5">
                    {/* Reference images: drag, upload, or paste */}
                    <ReferenceUploader
                      images={promptData.referenceImages}
                      onChange={(imgs) =>
                        updatePrompt(i, { referenceImages: imgs })
                      }
                      acceptPaste={activeTab === String(i)}
                    />

                    <Separator className="bg-zinc-800" />

                    {/* Prompt editor */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-zinc-400">
                          Prompt
                        </label>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => openPromptHelper(i)}
                          className="h-7 gap-1 text-xs text-violet-400 hover:bg-violet-950/30 hover:text-violet-300"
                        >
                          <Wand2 className="h-3 w-3" />
                          Prompt Helper
                        </Button>
                      </div>
                      <Textarea
                        value={promptData.prompt}
                        onChange={(e) => updatePrompt(i, { prompt: e.target.value })}
                        placeholder="Describe what you want to generate. Reference uploaded images as Figure 1, Figure 2, etc."
                        className="min-h-[100px] resize-y border-zinc-800 bg-zinc-900 font-mono text-xs leading-relaxed text-zinc-100 placeholder:text-zinc-600"
                      />
                    </div>

                    {/* Image analysis (if available) */}
                    {promptData.referenceImageAnalysis && (
                      <div className="rounded-md border border-zinc-800 bg-zinc-950/50">
                        <button
                          onClick={() =>
                            setExpandedAnalysis((prev) => ({
                              ...prev,
                              [i]: !prev[i],
                            }))
                          }
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-zinc-400 transition-colors hover:text-zinc-300"
                        >
                          {expandedAnalysis[i] ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          <Eye className="h-3 w-3" />
                          Reference Image Analysis
                        </button>
                        {expandedAnalysis[i] && (
                          <div className="whitespace-pre-wrap border-t border-zinc-800 px-3 py-2.5 text-xs leading-relaxed text-zinc-500">
                            {promptData.referenceImageAnalysis}
                          </div>
                        )}
                      </div>
                    )}

                    <Separator className="bg-zinc-800" />

                    {/* Generation controls */}
                    <GenerationControls
                      settings={settings}
                      onChange={setSettings}
                    />

                    {/* Generate button */}
                    <div className="flex items-center gap-3">
                      <Button
                        onClick={() => handleGenerate(i)}
                        disabled={
                          isGenerating ||
                          !promptData.prompt.trim() ||
                          promptData.referenceImages.length === 0
                        }
                        className="bg-violet-600 text-white hover:bg-violet-700"
                      >
                        {isGenerating && generatingTab === i ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Generate {isCarousel && `Image ${i + 1}`}
                          </>
                        )}
                      </Button>
                      {promptData.referenceImages.length === 0 && (
                        <span className="text-xs text-zinc-500">
                          Upload at least one reference image to start{" "}
                          <span className="text-zinc-600">
                            (Seedream 4.5 edit endpoint requires reference images)
                          </span>
                        </span>
                      )}
                    </div>

                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      </div>

      {/* Results gallery (unified across all tabs) */}
      <div className="border-t border-zinc-800 bg-zinc-950 p-5">
        <ResultsGallery
          images={post.generatedImages || []}
          history={post.generationHistory || []}
          onToggleSelect={handleToggleSelect}
          onIterate={handleIterate}
          onConfirmImages={handleConfirmImages}
          hasSelection={post.generatedImages?.some((i) => i.selected) || false}
        />
      </div>

      {/* Prompt Helper Dialog */}
      {promptHelperTabIndex !== null && (
        <PromptHelperDialog
          open={promptHelperOpen}
          onOpenChange={setPromptHelperOpen}
          currentPrompt={imagePrompts[promptHelperTabIndex]?.prompt || ""}
          referenceImages={
            imagePrompts[promptHelperTabIndex]?.referenceImages || []
          }
          onApplyPrompt={handleApplyPrompt}
        />
      )}
    </div>
  );
}
