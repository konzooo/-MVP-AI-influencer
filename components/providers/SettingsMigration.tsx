"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

const MIGRATION_KEYS = [
  { convexKey: "identity", lsKey: "ai-influencer-identity" },
  { convexKey: "aiSettings", lsKey: "ai-influencer-ai-settings" },
  { convexKey: "costSettings", lsKey: "ai-influencer-cost-settings" },
] as const;

/**
 * One-time migration: if Convex settings are empty but localStorage has data,
 * seed Convex from localStorage. Runs silently on app mount.
 */
export function SettingsMigration() {
  const identity = useQuery(api.settings.get, { key: "identity" });
  const aiSettings = useQuery(api.settings.get, { key: "aiSettings" });
  const costSettings = useQuery(api.settings.get, { key: "costSettings" });
  const set = useMutation(api.settings.set);
  const migrated = useRef(false);

  useEffect(() => {
    // Wait until all queries have loaded (not undefined)
    if (identity === undefined || aiSettings === undefined || costSettings === undefined) return;
    if (migrated.current) return;
    migrated.current = true;

    const convexValues = { identity, aiSettings, costSettings };

    for (const { convexKey, lsKey } of MIGRATION_KEYS) {
      const convexValue = convexValues[convexKey as keyof typeof convexValues];
      if (convexValue !== null) continue; // Convex already has data, skip

      try {
        const lsValue = localStorage.getItem(lsKey);
        if (lsValue) {
          // Validate it's valid JSON
          JSON.parse(lsValue);
          console.log(`[SettingsMigration] Migrating ${convexKey} from localStorage to Convex`);
          set({ key: convexKey, value: lsValue });
        }
      } catch {
        // Invalid JSON in localStorage, skip
      }
    }
  }, [identity, aiSettings, costSettings, set]);

  return null; // Invisible component
}
