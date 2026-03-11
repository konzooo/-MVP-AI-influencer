"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReferenceImageCard } from "@/components/reference-library/ReferenceImageCard";
import { ReferenceLibraryFilters } from "@/components/reference-library/ReferenceLibraryFilters";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  loadGeneratedImageLibrary,
  GENERATED_IMAGE_LIBRARY_UPDATED_EVENT,
  isGeneratedImageLibraryStorageEvent,
} from "@/lib/generated-image-library";
import { Images, Loader2, AlertCircle, Sparkles } from "lucide-react";
import type { ReferenceImage, ReferenceLibraryFilters as FiltersType } from "@/lib/types";

interface ReferenceLibraryBrowserProps {
  /** If true, enables selection mode by default */
  selectionMode?: boolean;
  /** Callback when images are selected (only in selection mode) */
  onImagesSelected?: (images: ReferenceImage[]) => void;
  /** Show header with title */
  showHeader?: boolean;
  /** Custom header content */
  headerContent?: React.ReactNode;
}

export function ReferenceLibraryBrowser({
  selectionMode: defaultSelectionMode = false,
  onImagesSelected,
  showHeader = true,
  headerContent,
}: ReferenceLibraryBrowserProps) {
  const [referenceImages, setReferenceImages] = useState<ReferenceImage[]>([]);
  const [generatedImages, setGeneratedImages] = useState<ReferenceImage[]>([]);
  const [referenceLoading, setReferenceLoading] = useState(true);
  const [referenceError, setReferenceError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"reference" | "generated">("reference");
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const selectionMode = defaultSelectionMode;

  const [filters, setFilters] = useState<FiltersType>({
    search: "",
    indoorOutdoor: "all",
    captureMethod: "all",
    framing: "all",
    expression: "all",
    timeOfDay: "all"
  });

  const loadReferenceImages = useCallback(async () => {
    try {
      setReferenceLoading(true);
      setReferenceError(null);

      const response = await fetch("/api/reference-images");
      if (!response.ok) {
        throw new Error("Failed to load reference images");
      }

      const data = await response.json();
      setReferenceImages(data.images || data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setReferenceError(msg);
      toast.error(msg);
    } finally {
      setReferenceLoading(false);
    }
  }, []);

  const loadGeneratedImages = useCallback(() => {
    setGeneratedImages(loadGeneratedImageLibrary());
  }, []);

  // Load images on mount
  useEffect(() => {
    loadReferenceImages();
    loadGeneratedImages();
  }, [loadGeneratedImages, loadReferenceImages]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleGeneratedLibraryUpdate = () => {
      loadGeneratedImages();
    };

    const handleStorage = (event: StorageEvent) => {
      if (isGeneratedImageLibraryStorageEvent(event)) {
        loadGeneratedImages();
      }
    };

    window.addEventListener(GENERATED_IMAGE_LIBRARY_UPDATED_EVENT, handleGeneratedLibraryUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(GENERATED_IMAGE_LIBRARY_UPDATED_EVENT, handleGeneratedLibraryUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, [loadGeneratedImages]);

  const images = activeTab === "reference" ? referenceImages : generatedImages;
  const hasMetadataFilters = activeTab === "reference";

  // Filter images based on current filters
  const filteredImages = useMemo(() => {
    return images.filter((image) => {
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        const matchesSearch =
          image.filename.toLowerCase().includes(searchTerm) ||
          image.summary.toLowerCase().includes(searchTerm) ||
          image.tags.some(tag => tag.toLowerCase().includes(searchTerm));

        if (!matchesSearch) return false;
      }

      if (!hasMetadataFilters) {
        return true;
      }

      // Location filter (handle "unknown" values)
      if (filters.indoorOutdoor !== "all" &&
          image.metadata.indoor_outdoor !== filters.indoorOutdoor &&
          image.metadata.indoor_outdoor !== "unknown") {
        return false;
      }

      // Capture method filter
      if (filters.captureMethod !== "all" && image.metadata.capture_method !== filters.captureMethod) {
        return false;
      }

      // Framing filter
      if (filters.framing !== "all" && image.metadata.framing !== filters.framing) {
        return false;
      }

      // Expression filter
      if (filters.expression !== "all" && image.metadata.expression.type !== filters.expression) {
        return false;
      }

      // Time of day filter (handle "unknown" values)
      if (filters.timeOfDay !== "all" &&
          image.metadata.time_of_day !== filters.timeOfDay &&
          image.metadata.time_of_day !== "unknown") {
        return false;
      }

      return true;
    });
  }, [filters, hasMetadataFilters, images]);

  const handleImageSelect = (image: ReferenceImage) => {
    if (!selectionMode) return;

    const newSelected = new Set(selectedImages);
    if (newSelected.has(image.id)) {
      newSelected.delete(image.id);
    } else {
      newSelected.add(image.id);
    }
    setSelectedImages(newSelected);
  };

  const handleConfirmSelection = () => {
    if (onImagesSelected) {
      const allImages = [...referenceImages, ...generatedImages];
      const selected = allImages.filter((img) => selectedImages.has(img.id));
      onImagesSelected(selected);
    }
  };


  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      {/* Header */}
      {showHeader && (
        <div className="border-b border-zinc-800 px-6 py-4">
          {headerContent || (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
                  <Images className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-semibold text-zinc-100">Reference Library</h1>
                  <p className="text-sm text-zinc-400">Browse reference images and saved fal.ai generations</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectionMode && (
                  <>
                    <span className={`text-sm ${selectedImages.size > 0 ? "text-zinc-300" : "text-zinc-600"}`}>
                      {selectedImages.size > 0 ? `${selectedImages.size} selected` : "None selected"}
                    </span>
                    {defaultSelectionMode && onImagesSelected && (
                      <Button
                        onClick={handleConfirmSelection}
                        disabled={selectedImages.size === 0}
                        size="sm"
                        className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
                      >
                        Add {selectedImages.size > 0 && `${selectedImages.size} `}
                        image{selectedImages.size !== 1 ? "s" : ""}
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrollable content - filters, button, and grid */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          <div className="mb-6 px-4">
            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as "reference" | "generated")}
              className="w-full"
            >
              <TabsList className="grid h-14 w-full grid-cols-2 overflow-hidden rounded-sm bg-zinc-950/60 p-0">
                <TabsTrigger
                  value="reference"
                  className="h-full w-full gap-2 rounded-none border-0 bg-transparent text-[15px] font-medium text-zinc-500 data-[state=active]:border-transparent data-[state=active]:bg-zinc-900/95 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
                >
                  <Images className="h-4 w-4" />
                  Reference Images
                </TabsTrigger>
                <TabsTrigger
                  value="generated"
                  className="h-full w-full gap-2 rounded-none border-0 bg-transparent text-[15px] font-medium text-zinc-500 data-[state=active]:border-transparent data-[state=active]:bg-zinc-900/95 data-[state=active]:text-zinc-100 data-[state=active]:shadow-none"
                >
                  <Sparkles className="h-4 w-4" />
                  Generated Images
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Filters */}
          <div className="mb-6">
            <ReferenceLibraryFilters
              filters={filters}
              onFiltersChange={setFilters}
              totalImages={images.length}
              filteredCount={filteredImages.length}
              showMetadataFilters={hasMetadataFilters}
              searchPlaceholder={
                activeTab === "reference"
                  ? "Search descriptions, tags, or filenames..."
                  : "Search prompts, tags, or filenames..."
              }
            />
          </div>

          {activeTab === "reference" && referenceLoading ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
                <p className="mt-2 text-sm text-zinc-400">Loading reference images...</p>
              </div>
            </div>
          ) : activeTab === "reference" && referenceError ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
                <p className="mt-2 text-sm text-zinc-400">Failed to load reference images</p>
                <p className="text-xs text-zinc-500">{referenceError}</p>
                <Button onClick={loadReferenceImages} variant="outline" className="mt-4">
                  Try Again
                </Button>
              </div>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Images className="mx-auto h-12 w-12 text-zinc-600" />
                <p className="mt-2 text-sm text-zinc-400">
                  {images.length === 0
                    ? activeTab === "reference"
                      ? "No reference images found"
                      : "No generated images saved yet"
                    : "No images match your filters"}
                </p>
                {images.length > 0 && (
                  <Button
                    onClick={() => setFilters({
                      search: "",
                      indoorOutdoor: "all",
                      captureMethod: "all",
                      framing: "all",
                      expression: "all",
                      timeOfDay: "all"
                    })}
                    variant="outline"
                    size="sm"
                    className="mt-2"
                  >
                    Clear Filters
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className={defaultSelectionMode ? "grid auto-rows-max grid-cols-6 gap-3" : "grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7"}>
              {filteredImages.map((image) => (
                <ReferenceImageCard
                  key={image.id}
                  image={image}
                  onSelect={handleImageSelect}
                  selectable={defaultSelectionMode}
                  selected={selectedImages.has(image.id)}
                />
              ))}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
