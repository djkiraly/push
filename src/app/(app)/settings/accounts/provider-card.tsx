"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Copy, ExternalLink, CheckCircle2, AlertCircle } from "lucide-react";
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

type Provider = "meta" | "tiktok" | "google";

type ProviderStatus = {
  configured: boolean;
  clientId: string | null;
  redirectUri: string;
  idSource: "settings" | "env" | "none";
  secretSource: "settings" | "env" | "none";
  hasSecret: boolean;
};

const START_HREF: Record<Provider, string> = {
  meta: "/api/oauth/meta/start",
  tiktok: "/api/oauth/tiktok/start",
  google: "/api/oauth/google/start",
};

export function ProviderCard({
  provider,
  title,
  docsHref,
  docsLabel,
  idLabel,
  secretLabel,
  idHint,
  secretHint,
  status,
  extra,
}: {
  provider: Provider;
  title: string;
  docsHref: string;
  docsLabel: string;
  idLabel: string;
  secretLabel: string;
  idHint?: string;
  secretHint?: string;
  status: ProviderStatus;
  extra?: React.ReactNode;
}): React.ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  async function save(): Promise<void> {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { provider };
      if (clientId.trim()) body.clientId = clientId.trim();
      if (clientSecret.trim()) body.clientSecret = clientSecret.trim();
      const res = await fetch("/api/oauth-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? `Save failed (${res.status})`);
      }
      setClientId("");
      setClientSecret("");
      setMsg({ kind: "ok", text: "Saved." });
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function clearStored(): Promise<void> {
    if (
      !confirm(
        `Remove the stored ${title} app credentials? You'll need to re-enter them to connect new accounts.`,
      )
    )
      return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/oauth-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          clientId: null,
          clientSecret: null,
        }),
      });
      if (!res.ok) throw new Error(`Clear failed (${res.status})`);
      setMsg({ kind: "ok", text: "Removed." });
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function copyRedirect(): Promise<void> {
    try {
      await navigator.clipboard.writeText(status.redirectUri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignored
    }
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{title}</CardTitle>
          {status.configured ? (
            <span className="flex items-center gap-1 text-xs text-emerald-400">
              <CheckCircle2 className="h-3.5 w-3.5" />
              configured
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-amber-400">
              <AlertCircle className="h-3.5 w-3.5" />
              not configured
            </span>
          )}
        </div>
        <CardDescription>
          <a
            href={docsHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sky-400 hover:underline"
          >
            {docsLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="space-y-2">
          <Label className="text-xs text-zinc-400">Redirect URI (copy this into the dev console)</Label>
          <div className="flex items-center gap-1">
            <code className="flex-1 truncate rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-[11px] text-zinc-300">
              {status.redirectUri}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={copyRedirect}
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" />
              {copied ? "Copied" : ""}
            </Button>
          </div>
        </div>

        {extra}

        <div className="mt-4 space-y-3">
          <div className="space-y-1">
            <Label htmlFor={`${provider}-id`}>{idLabel}</Label>
            <Input
              id={`${provider}-id`}
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={
                status.clientId
                  ? `${status.clientId.slice(0, 6)}…  (${status.idSource})`
                  : idHint ?? ""
              }
              autoComplete="off"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${provider}-secret`}>{secretLabel}</Label>
            <Input
              id={`${provider}-secret`}
              type="password"
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              placeholder={
                status.hasSecret
                  ? `set (${status.secretSource})`
                  : secretHint ?? ""
              }
              autoComplete="off"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={save} size="sm" disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {(status.idSource === "settings" || status.secretSource === "settings") ? (
              <Button
                onClick={clearStored}
                size="sm"
                variant="ghost"
                disabled={saving}
              >
                Remove
              </Button>
            ) : null}
            {msg ? (
              <span
                className={
                  msg.kind === "ok"
                    ? "text-xs text-emerald-400"
                    : "text-xs text-red-400"
                }
              >
                {msg.text}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-auto pt-4">
          {status.configured ? (
            <Button
              className="w-full"
              onClick={() => {
                window.location.href = START_HREF[provider];
              }}
            >
              Connect {title}
            </Button>
          ) : (
            <Button className="w-full" variant="outline" disabled>
              Save credentials to enable
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
