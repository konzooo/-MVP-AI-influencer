"use client";

import { useEffect, useRef } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

/**
 * One-time migration: if Convex instagramAuth is empty, try to migrate
 * from the old .instagram-auth.json file via a server-side API endpoint.
 */
export function InstagramAuthMigration() {
  const auth = useQuery(api.instagramAuth.get);
  const saveMutation = useMutation(api.instagramAuth.save);
  const migrated = useRef(false);

  useEffect(() => {
    if (auth === undefined) return; // Still loading
    if (migrated.current) return;
    migrated.current = true;

    // If Convex already has auth data, skip
    if (auth !== null) return;

    // Try to read from the legacy file via API
    (async () => {
      try {
        const res = await fetch("/api/instagram/migrate-auth");
        if (!res.ok) return;

        const data = await res.json();
        if (!data.auth) return;

        console.log("[InstagramAuthMigration] Migrating auth from .instagram-auth.json to Convex");
        await saveMutation(data.auth);
        console.log("[InstagramAuthMigration] Migration complete");
      } catch (error) {
        console.error("[InstagramAuthMigration] Failed:", error);
      }
    })();
  }, [auth, saveMutation]);

  return null;
}
