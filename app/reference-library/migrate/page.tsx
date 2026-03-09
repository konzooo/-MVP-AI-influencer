"use client";

import { useState } from "react";
import { useAuthToken } from "@convex-dev/auth/react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * One-time migration page: uploads local reference images to Convex storage.
 * Only works in local dev (the migrate API checks NODE_ENV).
 * Delete this page after migration is complete.
 */
export default function MigratePage() {
  const token = useAuthToken();
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">("idle");
  const [result, setResult] = useState<any>(null);
  const [log, setLog] = useState<string[]>([]);

  const runMigration = async () => {
    setStatus("running");
    setLog(["Starting migration..."]);

    try {
      if (!token) {
        setLog((l) => [...l, "ERROR: Not authenticated. Please log in first."]);
        setStatus("error");
        return;
      }

      setLog((l) => [...l, "Got auth token, calling migration endpoint..."]);

      const res = await fetch("/api/reference-images/migrate", {
        method: "POST",
        headers: {
          "x-convex-auth": token,
        },
      });

      const data = await res.json();

      if (!res.ok) {
        setLog((l) => [...l, `ERROR: ${data.error}`]);
        setStatus("error");
        return;
      }

      setResult(data);
      setLog((l) => [
        ...l,
        `Migration complete!`,
        `✓ ${data.ok} migrated`,
        `→ ${data.skipped} skipped`,
        `✗ ${data.errors} errors`,
      ]);

      if (data.results) {
        for (const r of data.results) {
          if (r.status === "error") {
            setLog((l) => [...l, `  ERROR ${r.file}: ${r.message}`]);
          }
        }
      }

      setStatus("done");
    } catch (err) {
      setLog((l) => [...l, `EXCEPTION: ${err instanceof Error ? err.message : "unknown"}`]);
      setStatus("error");
    }
  };

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h1 className="mb-2 text-xl font-semibold text-zinc-100">Reference Image Migration</h1>
      <p className="mb-6 text-sm text-zinc-500">
        Uploads local reference images to Convex storage. Run once, then delete this page.
      </p>

      <Card className="border-zinc-800 bg-zinc-900 p-6">
        <Button
          onClick={runMigration}
          disabled={status === "running" || status === "done"}
          className="bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-40"
        >
          {status === "running" ? "Migrating..." : status === "done" ? "Done!" : "Run Migration"}
        </Button>

        {log.length > 0 && (
          <div className="mt-4 rounded-lg bg-zinc-950 p-4 font-mono text-xs">
            {log.map((line, i) => (
              <div key={i} className="text-zinc-300">
                {line}
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
