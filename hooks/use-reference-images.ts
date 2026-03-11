"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";

export interface ReferenceImageEntry {
  _id: string;
  imageId: string;
  sourceKey: string;
  filename: string;
  summary: string;
  tags: string[];
  createdAt: string;
}

/**
 * Hook to load reference images from Convex.
 * Includes metadata but not URLs — URLs should be fetched separately
 * via getImageUrl queries to avoid loading all URLs at once.
 */
export function useReferenceImages() {
  const rawImages = useQuery(api.referenceImages.list);

  const images: ReferenceImageEntry[] = useMemo(() => {
    if (!rawImages) return [];
    return rawImages.map((img) => ({
      _id: img._id as string,
      imageId: img.imageId,
      sourceKey: img.sourceKey,
      filename: img.filename,
      summary: img.summary,
      tags: img.tags,
      createdAt: img.createdAt,
    }));
  }, [rawImages]);

  const isLoading = rawImages === undefined;

  return { images, isLoading };
}
