"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

type UploadResult = {
  filename: string;
  status: "ingested" | "deduped" | "skipped";
  id?: string;
  reason?: string;
};

export function UploadDropzone(): React.ReactElement {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [recent, setRecent] = useState<UploadResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function upload(files: FileList | File[]): Promise<void> {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      for (const f of Array.from(files)) {
        form.append("file", f);
      }
      const res = await fetch("/api/media/upload", {
        method: "POST",
        body: form,
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { results: UploadResult[] };
        error?: string;
      };
      if (!res.ok) {
        setError(body.error ?? `Upload failed (${res.status})`);
        return;
      }
      setRecent(body.data?.results ?? []);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length > 0) {
            void upload(e.dataTransfer.files);
          }
        }}
        className={
          "flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-8 text-sm transition-colors " +
          (dragOver
            ? "border-zinc-400 bg-zinc-900/50"
            : "border-zinc-700 bg-zinc-950/50")
        }
      >
        <p className="text-zinc-400">
          {busy ? "Uploading…" : "Drag files here, or click to select"}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={busy}
        >
          Choose files
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept="image/*,video/*"
          onChange={(e) => {
            if (e.target.files) void upload(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-400">{error}</p>
      ) : null}

      {recent.length > 0 ? (
        <ul className="mt-4 space-y-1 text-xs">
          {recent.map((r, i) => (
            <li key={i} className="text-zinc-400">
              <span
                className={
                  r.status === "ingested"
                    ? "text-emerald-400"
                    : r.status === "deduped"
                      ? "text-amber-400"
                      : "text-red-400"
                }
              >
                {r.status}
              </span>{" "}
              — {r.filename}
              {r.reason ? ` (${r.reason})` : ""}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
