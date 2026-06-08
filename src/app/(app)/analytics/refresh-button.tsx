"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RefreshButton({
  lastSnapshotLabel,
}: {
  lastSnapshotLabel: string;
}): React.ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/analytics/refresh", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { polled: number };
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Failed (${res.status})`);
      setMsg(`Polled ${body.data?.polled ?? 0} posts.`);
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs text-zinc-500">{msg ?? lastSnapshotLabel}</span>
      <Button variant="outline" size="sm" onClick={refresh} disabled={busy}>
        <RefreshCcw className="h-3.5 w-3.5" />
        {busy ? "Refreshing…" : "Refresh now"}
      </Button>
    </div>
  );
}
