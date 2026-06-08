"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AccountRow({
  id,
  platform,
  displayName,
  externalId,
  enabled,
  tokenExpiresAt,
}: {
  id: string;
  platform: string;
  displayName: string;
  externalId: string;
  enabled: boolean;
  tokenExpiresAt: string | null;
}): React.ReactElement {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function toggle(): Promise<void> {
    setBusy(true);
    try {
      await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !enabled }),
      });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(): Promise<void> {
    if (!confirm(`Disconnect ${displayName}?`)) return;
    setBusy(true);
    try {
      await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-200">{displayName}</span>
          <span className="rounded bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
            {platform}
          </span>
          {!enabled ? (
            <span className="rounded bg-amber-900/50 px-2 py-0.5 text-xs text-amber-300">
              disabled
            </span>
          ) : null}
        </div>
        <p className="mt-1 truncate text-xs text-zinc-500">
          id: {externalId}
          {tokenExpiresAt
            ? ` · token expires ${new Date(tokenExpiresAt).toLocaleString()}`
            : ""}
        </p>
      </div>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={toggle}
          disabled={busy || pending}
        >
          {enabled ? "Disable" : "Enable"}
        </Button>
        <Button
          variant="destructive"
          size="sm"
          onClick={disconnect}
          disabled={busy || pending}
        >
          Disconnect
        </Button>
      </div>
    </li>
  );
}
