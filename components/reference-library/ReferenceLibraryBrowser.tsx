"use client";

import { useState, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ReferenceImageCard } from "@/components/reference-library/ReferenceImageCard";
import { ReferenceLibraryFilters } from "@/components/reference-library/ReferenceLibraryFilters";
import { Button } from "@/components/ui/button";
import { Images, Loader2, AlertCircle } from "lucide-react";
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
  const [images, setImages] = useState<ReferenceImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set());
  const [selectionMode, setSelectionMode] = useState(defaultSelectionMode);

  const [filters, setFilters] = useState<FiltersType>({
    search: "",
    indoorOutdoor: "all",
    captureMethod: "all",
    framing: "all",
    expression: "all",
    timeOfDay: "all"
  });

  // Load images on mount
  useEffect(() => {
    loadImages();
  }, []);

  const loadImages = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/reference-images");
      if (!response.ok) {
        throw new Error("Failed to load reference images");
      }

      const data = await response.json();
      setImages(data.images || data || []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "An error occurred";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

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
  }, [images, filters]);

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

  const toggleSelectionMode = () => {
    setSelectionMode(!selectionMode);
    if (selectionMode) {
      setSelectedImages(new Set());
    }
  };

  const handleConfirmSelection = () => {
    if (onImagesSelected) {
      const selected = images.filter((img) => selectedImages.has(img.id));
      onImagesSelected(selected);
    }
  };


  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-violet-500" />
          <p className="mt-2 text-sm text-zinc-400">Loading reference images...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-red-500" />
          <p className="mt-2 text-sm text-zinc-400">Failed to load images</p>
          <p className="text-xs text-zinc-500">{error}</p>
          <Button onClick={loadImages} variant="outline" className="mt-4">
            Try Again
          </Button>
        </div>
      </div>
    );
  }

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
                  <p className="text-sm text-zinc-400">Browse and select reference images</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {selectionMode && selectedImages.size > 0 && (
                  <span className="text-sm text-zinc-400">
                    {selectedImages.size} selected
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Scrollable content - filters, button, and grid */}
      <ScrollArea className="flex-1 min-h-0">
        <div className="p-6">
          {/* Filters */}
          <div className="mb-6">
            <ReferenceLibraryFilters
              filters={filters}
              onFiltersChange={setFilters}
              totalImages={images.length}
              filteredCount={filteredImages.length}
            />
          </div>

          {/* Confirmation button - only in modal, positioned above grid */}
          {defaultSelectionMode && onImagesSelected && (
            <div className="mb-4 flex justify-end">
              <Button
                onClick={handleConfirmSelection}
                disabled={selectedImages.size === 0}
                size="sm"
              >
                Add {selectedImages.size > 0 && `${selectedImages.size} `}
                image{selectedImages.size !== 1 ? "s" : ""}
              </Button>
            </div>
          )}

          {filteredImages.length === 0 ? (
            <div className="flex h-64 items-center justify-center">
              <div className="text-center">
                <Images className="mx-auto h-12 w-12 text-zinc-600" />
                <p className="mt-2 text-sm text-zinc-400">
                  {images.length === 0 ? "No reference images found" : "No images match your filters"}
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
