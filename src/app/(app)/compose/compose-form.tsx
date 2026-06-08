"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Platform = "FACEBOOK" | "INSTAGRAM" | "TIKTOK" | "YOUTUBE";

export type ComposeAccount = {
  id: string;
  platform: Platform;
  platformLabel: string;
  displayName: string;
};

export type ComposeMedia = {
  id: string;
  filename: string;
  mimeType: string;
  bytes: number;
  width: number | null;
  height: number | null;
  durationMs: number | null;
  kind: "IMAGE" | "VIDEO" | "OTHER";
};

type Variant = {
  accountId: string;
  caption: string;
  hashtags: string;
  scheduledFor: string;
};

function deriveContentType(media: ComposeMedia[]): "IMAGE" | "CAROUSEL" | "SHORT_VIDEO" {
  if (media.length === 0) return "IMAGE";
  if (media.some((m) => m.kind === "VIDEO")) return "SHORT_VIDEO";
  if (media.length > 1) return "CAROUSEL";
  return "IMAGE";
}

export function ComposeForm({
  accounts,
  media,
  aiReady,
}: {
  accounts: ComposeAccount[];
  media: ComposeMedia[];
  aiReady: boolean;
}): React.ReactElement {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [baseCaption, setBaseCaption] = useState("");
  const [notes, setNotes] = useState("");
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [variants, setVariants] = useState<Record<string, Variant>>({});
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  const selectedMedia = useMemo(
    () =>
      selectedMediaIds
        .map((id) => media.find((m) => m.id === id))
        .filter((m): m is ComposeMedia => Boolean(m)),
    [selectedMediaIds, media],
  );

  const contentType = deriveContentType(selectedMedia);
  const activeAccountIds = Object.keys(variants);
  const activePlatforms: Platform[] = Array.from(
    new Set(
      activeAccountIds
        .map((id) => accounts.find((a) => a.id === id)?.platform)
        .filter((p): p is Platform => Boolean(p)),
    ),
  );

  function toggleAccount(account: ComposeAccount): void {
    setVariants((cur) => {
      const next = { ...cur };
      if (next[account.id]) {
        delete next[account.id];
      } else {
        next[account.id] = {
          accountId: account.id,
          caption: baseCaption,
          hashtags: "",
          scheduledFor: "",
        };
      }
      return next;
    });
  }

  function setVariantField(
    accountId: string,
    field: keyof Variant,
    value: string,
  ): void {
    setVariants((cur) => {
      const v = cur[accountId];
      if (!v) return cur;
      return { ...cur, [accountId]: { ...v, [field]: value } };
    });
  }

  function toggleMedia(id: string): void {
    setSelectedMediaIds((cur) =>
      cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id],
    );
  }

  function moveMedia(index: number, dir: -1 | 1): void {
    setSelectedMediaIds((cur) => {
      const next = [...cur];
      const target = index + dir;
      if (target < 0 || target >= next.length) return cur;
      const a = next[index];
      const b = next[target];
      if (a === undefined || b === undefined) return cur;
      next[index] = b;
      next[target] = a;
      return next;
    });
  }

  async function generateAi(): Promise<void> {
    if (!aiReady) {
      setMsg({
        kind: "err",
        text: "AI not configured. Set a key in Settings → AI captions.",
      });
      return;
    }
    if (activePlatforms.length === 0) {
      setMsg({ kind: "err", text: "Pick at least one platform first." });
      return;
    }
    if (!baseCaption.trim()) {
      setMsg({ kind: "err", text: "Write a base caption first." });
      return;
    }
    setGenerating(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/generate-captions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          baseCaption,
          title: title || undefined,
          notes: notes || undefined,
          platforms: activePlatforms,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: {
          variants: Array<{
            platform: Platform;
            caption: string;
            hashtags: string;
          }>;
        };
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Generate failed (${res.status})`);
      const byPlatform = new Map(
        (body.data?.variants ?? []).map((v) => [v.platform, v]),
      );

      setVariants((cur) => {
        const next = { ...cur };
        for (const [accountId, v] of Object.entries(next)) {
          const account = accounts.find((a) => a.id === accountId);
          if (!account) continue;
          const ai = byPlatform.get(account.platform);
          if (ai) {
            next[accountId] = {
              ...v,
              caption: ai.caption,
              hashtags: ai.hashtags,
            };
          }
        }
        return next;
      });
      setMsg({ kind: "ok", text: "Captions generated." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setGenerating(false);
    }
  }

  async function save(status: "DRAFT" | "APPROVED"): Promise<void> {
    setMsg(null);
    if (!title.trim()) {
      setMsg({ kind: "err", text: "Title is required." });
      return;
    }
    if (!baseCaption.trim()) {
      setMsg({ kind: "err", text: "Base caption is required." });
      return;
    }
    if (selectedMediaIds.length === 0) {
      setMsg({ kind: "err", text: "Pick at least one media asset." });
      return;
    }
    const variantList = Object.values(variants);
    if (variantList.length === 0) {
      setMsg({ kind: "err", text: "Pick at least one target account." });
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title,
          baseCaption,
          contentType,
          notes: notes || null,
          status,
          mediaIds: selectedMediaIds,
          variants: variantList.map((v) => ({
            accountId: v.accountId,
            caption: v.caption,
            hashtags: v.hashtags || null,
            scheduledFor: v.scheduledFor
              ? new Date(v.scheduledFor).toISOString()
              : null,
            status: v.scheduledFor ? "SCHEDULED" : "DRAFT",
          })),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { id: string };
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Save failed (${res.status})`);
      router.push("/approvals");
      router.refresh();
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-6 lg:col-span-2">
        <Card>
          <CardHeader>
            <CardTitle>Content</CardTitle>
            <CardDescription>
              Base caption is shared; per-platform variants below override it.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Internal title — not posted"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="base-caption">Base caption</Label>
              <textarea
                id="base-caption"
                value={baseCaption}
                onChange={(e) => setBaseCaption(e.target.value)}
                rows={5}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-sm"
                placeholder="What's the core idea?"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional, sent to AI)</Label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 p-3 text-sm"
                placeholder="Tone, audience, must-mention, etc."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Media ({selectedMedia.length} selected)</CardTitle>
            <CardDescription>
              Detected: {contentType}. Click to add; the first becomes the cover.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {selectedMedia.length > 0 ? (
              <ul className="mb-4 flex flex-wrap gap-2">
                {selectedMedia.map((m, i) => (
                  <li
                    key={m.id}
                    className="relative h-20 w-20 overflow-hidden rounded border border-zinc-700"
                  >
                    {m.kind === "IMAGE" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={`/api/media/${m.id}/thumb`}
                        alt={m.filename}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-[10px] text-zinc-400">
                        VIDEO
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => toggleMedia(m.id)}
                      className="absolute top-0.5 right-0.5 rounded bg-black/70 p-0.5 text-zinc-300 hover:text-red-400"
                      aria-label="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="absolute right-0 bottom-0 left-0 flex justify-between bg-black/60 px-1 text-[10px] text-zinc-200">
                      <button
                        type="button"
                        onClick={() => moveMedia(i, -1)}
                        disabled={i === 0}
                        className="disabled:opacity-30"
                      >
                        ◀
                      </button>
                      <span>{i + 1}</span>
                      <button
                        type="button"
                        onClick={() => moveMedia(i, 1)}
                        disabled={i === selectedMedia.length - 1}
                        className="disabled:opacity-30"
                      >
                        ▶
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}

            {media.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Library is empty. Upload media on the{" "}
                <a href="/library" className="text-zinc-300 underline">
                  Library
                </a>{" "}
                page.
              </p>
            ) : (
              <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-7">
                {media.map((m) => {
                  const selected = selectedMediaIds.includes(m.id);
                  return (
                    <li key={m.id}>
                      <button
                        type="button"
                        onClick={() => toggleMedia(m.id)}
                        className={
                          "relative block aspect-square w-full overflow-hidden rounded border-2 " +
                          (selected
                            ? "border-emerald-500"
                            : "border-zinc-800 hover:border-zinc-600")
                        }
                      >
                        {m.kind === "IMAGE" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`/api/media/${m.id}/thumb`}
                            alt={m.filename}
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-[10px] text-zinc-400">
                            VIDEO
                          </div>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Per-platform variants</CardTitle>
            <CardDescription>
              Each selected account becomes its own scheduled post.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {activeAccountIds.length === 0 ? (
              <p className="text-sm text-zinc-500">
                Select accounts on the right to add variants.
              </p>
            ) : (
              <div className="space-y-4">
                {activeAccountIds.map((accountId) => {
                  const account = accounts.find((a) => a.id === accountId);
                  const v = variants[accountId];
                  if (!account || !v) return null;
                  return (
                    <div
                      key={accountId}
                      className="rounded-md border border-zinc-800 p-3"
                    >
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-sm font-medium">
                          {account.displayName}{" "}
                          <span className="text-xs text-zinc-500">
                            {account.platformLabel}
                          </span>
                        </p>
                      </div>
                      <textarea
                        value={v.caption}
                        onChange={(e) =>
                          setVariantField(accountId, "caption", e.target.value)
                        }
                        rows={4}
                        className="w-full rounded-md border border-zinc-800 bg-zinc-900/50 p-2 text-sm"
                        placeholder="Caption for this account"
                      />
                      <Input
                        value={v.hashtags}
                        onChange={(e) =>
                          setVariantField(accountId, "hashtags", e.target.value)
                        }
                        placeholder="#hashtags space separated"
                        className="mt-2"
                      />
                      <div className="mt-2 flex items-center gap-2">
                        <Label
                          htmlFor={`sched-${accountId}`}
                          className="text-xs text-zinc-400"
                        >
                          Schedule
                        </Label>
                        <input
                          id={`sched-${accountId}`}
                          type="datetime-local"
                          value={v.scheduledFor}
                          onChange={(e) =>
                            setVariantField(
                              accountId,
                              "scheduledFor",
                              e.target.value,
                            )
                          }
                          className="h-9 rounded-md border border-zinc-800 bg-zinc-900/50 px-2 text-sm"
                        />
                        {v.scheduledFor ? (
                          <button
                            type="button"
                            className="text-xs text-zinc-500 hover:text-zinc-300"
                            onClick={() =>
                              setVariantField(accountId, "scheduledFor", "")
                            }
                          >
                            clear
                          </button>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Targets</CardTitle>
            <CardDescription>
              Only enabled, connected accounts appear here.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accounts.length === 0 ? (
              <p className="text-sm text-zinc-500">
                No accounts yet —{" "}
                <a
                  href="/settings/accounts"
                  className="text-zinc-300 underline"
                >
                  connect one
                </a>
                .
              </p>
            ) : (
              <ul className="space-y-1">
                {accounts.map((a) => {
                  const checked = Boolean(variants[a.id]);
                  return (
                    <li key={a.id}>
                      <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-zinc-900">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleAccount(a)}
                          className="accent-emerald-500"
                        />
                        <span>{a.displayName}</span>
                        <span className="ml-auto text-xs text-zinc-500">
                          {a.platformLabel}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>AI</CardTitle>
            <CardDescription>
              {aiReady
                ? "Tailor base caption to each selected platform."
                : "Configure a key in Settings → AI captions to enable."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="default"
              onClick={generateAi}
              disabled={!aiReady || generating || activePlatforms.length === 0}
              className="w-full"
            >
              <Sparkles className="h-4 w-4" />
              {generating ? "Generating…" : "Generate variants"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Save</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Button
                variant="outline"
                onClick={() => save("DRAFT")}
                disabled={busy}
                className="w-full"
              >
                {busy ? "Saving…" : "Save as draft"}
              </Button>
              <Button
                variant="default"
                onClick={() => save("APPROVED")}
                disabled={busy}
                className="w-full"
              >
                {busy ? "Saving…" : "Approve & schedule"}
              </Button>
            </div>
            {msg ? (
              <p
                className={
                  msg.kind === "ok"
                    ? "mt-3 text-xs text-emerald-400"
                    : "mt-3 text-xs text-red-400"
                }
              >
                {msg.text}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
