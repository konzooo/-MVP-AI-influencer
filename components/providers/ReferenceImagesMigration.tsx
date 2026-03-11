"use client";

import { useEffect, useRef } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * This component is a placeholder for now.
 * The actual reference image migration happens via the CLI script:
 * `npx ts-node scripts/migrate-reference-images.ts`
 *
 * Once that script runs, the images are in Convex storage and the
 * referenceImages table is populated. This component ensures we're
 * ready to display them.
 */
export function ReferenceImagesMigration() {
  const images = useQuery(api.referenceImages.list);
  const loaded = useRef(false);

  useEffect(() => {
    if (images !== undefined && !loaded.current) {
      loaded.current = true;
      if (images.length > 0) {
        console.log(`[ReferenceImagesMigration] ${images.length} images available in Convex`);
      }
    }
  }, [images]);

  return null;
}
