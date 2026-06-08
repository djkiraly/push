"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, X, Play, RefreshCcw, Ban } from "lucide-react";

type VariantStatus =
  | "DRAFT"
  | "SCHEDULED"
  | "PUBLISHING"
  | "PUBLISHED"
  | "FAILED"
  | "CANCELLED";

type PostStatus = "DRAFT" | "PENDING_APPROVAL" | "APPROVED" | "ARCHIVED";

export type ApprovalVariant = {
  id: string;
  platform: string;
  platformLabel: string;
  status: VariantStatus;
  caption: string;
  hashtags: string | null;
  scheduledFor: string | null;
  publishedAt: string | null;
  attempts: number;
  lastError: string | null;
  externalPermalink: string | null;
  accountName: string;
};

export type ApprovalPost = {
  id: string;
  title: string;
  baseCaption: string;
  contentType: string;
  status: PostStatus;
  updatedAt: string;
  coverMediaId: string | null;
  variants: ApprovalVariant[];
};

const STATUS_COLORS: Record<VariantStatus, string> = {
  DRAFT: "bg-zinc-800 text-zinc-300",
  SCHEDULED: "bg-sky-900/60 text-sky-300",
  PUBLISHING: "bg-amber-900/60 text-amber-200",
  PUBLISHED: "bg-emerald-900/60 text-emerald-300",
  FAILED: "bg-red-900/60 text-red-300",
  CANCELLED: "bg-zinc-900 text-zinc-500",
};

function fmt(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

export function ApprovalsList({
  posts,
}: {
  posts: ApprovalPost[];
}): React.ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  async function call(url: string, init?: RequestInit): Promise<boolean> {
    setBusy(url);
    try {
      const res = await fetch(url, init);
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        alert(body.error ?? `Request failed (${res.status})`);
        return false;
      }
      startTransition(() => router.refresh());
      return true;
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-4">
      {posts.map((post) => (
        <Card key={post.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <div className="flex gap-3">
                {post.coverMediaId ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`/api/media/${post.coverMediaId}/thumb`}
                    alt=""
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : (
                  <div className="h-16 w-16 rounded bg-zinc-900" />
                )}
                <div>
                  <CardTitle className="text-base">{post.title}</CardTitle>
                  <p className="mt-1 line-clamp-2 max-w-xl text-xs text-zinc-500">
                    {post.baseCaption}
                  </p>
                  <p className="mt-1 text-[10px] text-zinc-600">
                    {post.contentType} · post {post.status.toLowerCase()} · updated{" "}
                    {fmt(post.updatedAt)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 gap-2">
                {post.status !== "APPROVED" && post.status !== "ARCHIVED" ? (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={busy !== null}
                    onClick={() => call(`/api/posts/${post.id}/approve`, { method: "POST" })}
                  >
                    <Check className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                ) : null}
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={busy !== null}
                  onClick={() => {
                    if (confirm("Reject post and cancel all variants?")) {
                      void call(`/api/posts/${post.id}/reject`, { method: "POST" });
                    }
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <ul className="divide-y divide-zinc-800">
              {post.variants.map((v) => (
                <li key={v.id} className="py-3">
                  <VariantRow variant={v} busy={busy} onCall={call} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function VariantRow({
  variant: v,
  busy,
  onCall,
}: {
  variant: ApprovalVariant;
  busy: string | null;
  onCall: (url: string, init?: RequestInit) => Promise<boolean>;
}): React.ReactElement {
  const [editing, setEditing] = useState(false);
  const [caption, setCaption] = useState(v.caption);
  const [hashtags, setHashtags] = useState(v.hashtags ?? "");
  const [scheduledFor, setScheduledFor] = useState(
    v.scheduledFor ? new Date(v.scheduledFor).toISOString().slice(0, 16) : "",
  );

  async function saveEdit(): Promise<void> {
    const body: Record<string, unknown> = { caption, hashtags };
    if (scheduledFor) {
      body.scheduledFor = new Date(scheduledFor).toISOString();
      body.status = "SCHEDULED";
    } else {
      body.scheduledFor = null;
    }
    const ok = await onCall(`/api/platform-posts/${v.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (ok) setEditing(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-zinc-200">
            <span
              className={
                "mr-2 inline-block rounded px-1.5 py-0.5 text-[10px] " +
                STATUS_COLORS[v.status]
              }
            >
              {v.status}
            </span>
            <span className="font-medium">{v.accountName}</span>
            <span className="ml-2 text-xs text-zinc-500">{v.platformLabel}</span>
          </p>
          <p className="mt-1 text-xs text-zinc-500">
            {v.status === "PUBLISHED"
              ? `Published ${fmt(v.publishedAt)}`
              : v.scheduledFor
                ? `Scheduled ${fmt(v.scheduledFor)}`
                : "Not scheduled"}
            {v.attempts > 0 ? ` · attempts: ${v.attempts}` : ""}
          </p>
          {v.lastError ? (
            <p className="mt-1 truncate text-xs text-red-400" title={v.lastError}>
              {v.lastError}
            </p>
          ) : null}
          {v.externalPermalink ? (
            <a
              className="text-xs text-sky-400 hover:underline"
              href={v.externalPermalink}
              target="_blank"
              rel="noreferrer"
            >
              View live
            </a>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-1">
          {v.status === "FAILED" ? (
            <Button
              size="sm"
              variant="outline"
              disabled={busy !== null}
              onClick={() =>
                onCall(`/api/platform-posts/${v.id}/retry`, { method: "POST" })
              }
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              Retry
            </Button>
          ) : null}
          {(v.status === "DRAFT" ||
            v.status === "SCHEDULED" ||
            v.status === "FAILED") ? (
            <Button
              size="sm"
              variant="default"
              disabled={busy !== null}
              onClick={() =>
                onCall(`/api/platform-posts/${v.id}/publish-now`, {
                  method: "POST",
                })
              }
            >
              <Play className="h-3.5 w-3.5" />
              Publish now
            </Button>
          ) : null}
          {v.status !== "PUBLISHED" && v.status !== "CANCELLED" ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setEditing((s) => !s)}
            >
              {editing ? "Close" : "Edit"}
            </Button>
          ) : null}
          {(v.status === "DRAFT" || v.status === "SCHEDULED") ? (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy !== null}
              onClick={() =>
                onCall(`/api/platform-posts/${v.id}`, {
                  method: "PATCH",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ status: "CANCELLED" }),
                })
              }
            >
              <Ban className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {editing ? (
        <div className="mt-3 space-y-2 rounded border border-zinc-800 bg-zinc-950 p-3">
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 p-2 text-sm"
          />
          <input
            type="text"
            value={hashtags}
            onChange={(e) => setHashtags(e.target.value)}
            placeholder="#hashtags"
            className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 px-2 py-1 text-sm"
          />
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400">Schedule</label>
            <input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              className="h-8 rounded-md border border-zinc-800 bg-zinc-900/50 px-2 text-sm"
            />
            {scheduledFor ? (
              <button
                type="button"
                className="text-xs text-zinc-500 hover:text-zinc-300"
                onClick={() => setScheduledFor("")}
              >
                clear
              </button>
            ) : null}
            <Button size="sm" onClick={saveEdit} disabled={busy !== null}>
              Save
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
