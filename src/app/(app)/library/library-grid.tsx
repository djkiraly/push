"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Film, Image as ImageIcon, FileQuestion } from "lucide-react";

type Item = {
  id: string;
  filename: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  source: string;
  createdAt: string;
  kind: "IMAGE" | "VIDEO" | "OTHER";
};

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDuration(ms: number | null): string | null {
  if (ms == null) return null;
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function LibraryGrid({ items }: { items: Item[] }): React.ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);
  const [preview, setPreview] = useState<Item | null>(null);

  async function remove(item: Item): Promise<void> {
    if (!confirm(`Delete "${item.filename}" from the library and disk?`)) return;
    setBusy(item.id);
    try {
      await fetch(`/api/media/${item.id}`, { method: "DELETE" });
      startTransition(() => router.refresh());
    } finally {
      setBusy(null);
    }
  }

  if (items.length === 0) {
    return <p className="text-sm text-zinc-500">Library is empty.</p>;
  }

  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <li
            key={item.id}
            className="group relative overflow-hidden rounded-md border border-zinc-800 bg-zinc-950"
          >
            <button
              type="button"
              onClick={() => setPreview(item)}
              className="block aspect-square w-full"
              aria-label={`Preview ${item.filename}`}
            >
              {item.kind === "IMAGE" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`/api/media/${item.id}/thumb`}
                  alt={item.filename}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-zinc-500">
                  {item.kind === "VIDEO" ? (
                    <Film className="h-8 w-8" />
                  ) : (
                    <FileQuestion className="h-8 w-8" />
                  )}
                </div>
              )}
            </button>

            <div className="absolute top-1 left-1 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-zinc-300">
              {item.kind === "IMAGE" ? (
                <ImageIcon className="h-3 w-3" />
              ) : item.kind === "VIDEO" ? (
                <Film className="h-3 w-3" />
              ) : null}
              <span>
                {item.width && item.height
                  ? `${item.width}×${item.height}`
                  : item.kind}
              </span>
              {formatDuration(item.durationMs) ? (
                <span>· {formatDuration(item.durationMs)}</span>
              ) : null}
            </div>

            <button
              type="button"
              onClick={() => remove(item)}
              disabled={busy === item.id}
              className="absolute top-1 right-1 rounded bg-black/60 p-1 text-zinc-300 opacity-0 transition-opacity hover:text-red-400 group-hover:opacity-100"
              aria-label="Delete"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>

            <div className="px-2 py-1.5">
              <p className="truncate text-xs text-zinc-300" title={item.filename}>
                {item.filename}
              </p>
              <p className="text-[10px] text-zinc-500">
                {formatBytes(item.bytes)} · {item.source.toLowerCase()}
              </p>
            </div>
          </li>
        ))}
      </ul>

      {preview ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setPreview(null)}
        >
          <div
            className="max-h-full max-w-5xl"
            onClick={(e) => e.stopPropagation()}
          >
            {preview.kind === "VIDEO" ? (
              <video
                src={`/api/media/${preview.id}/file`}
                controls
                autoPlay
                className="max-h-[85vh] max-w-full"
              />
            ) : preview.kind === "IMAGE" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={`/api/media/${preview.id}/file`}
                alt={preview.filename}
                className="max-h-[85vh] max-w-full object-contain"
              />
            ) : (
              <p className="text-zinc-300">No preview available</p>
            )}
            <p className="mt-2 text-center text-xs text-zinc-400">
              {preview.filename} · {formatBytes(preview.bytes)}
              {preview.width && preview.height
                ? ` · ${preview.width}×${preview.height}`
                : ""}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
