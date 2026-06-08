"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Provider = "anthropic" | "openai";

export function AiSettingsForm({
  initialProvider,
  initialModel,
  defaultModels,
  keyStatus,
}: {
  initialProvider: Provider;
  initialModel: string;
  defaultModels: Record<Provider, string>;
  keyStatus: { source: "settings" | "env" | "none"; hasKey: boolean };
}): React.ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [provider, setProvider] = useState<Provider>(initialProvider);
  const [model, setModel] = useState(initialModel);
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  async function save(): Promise<void> {
    setSaving(true);
    setMsg(null);
    try {
      const body: Record<string, unknown> = { provider, model };
      if (anthropicKey) body.anthropicKey = anthropicKey;
      if (openaiKey) body.openaiKey = openaiKey;
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const e = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(e.error ?? `Save failed (${res.status})`);
      }
      setAnthropicKey("");
      setOpenaiKey("");
      setMsg({ kind: "ok", text: "Saved." });
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  async function test(): Promise<void> {
    setPinging(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/ping", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as {
        data?: { model: string };
        error?: string;
      };
      if (!res.ok) throw new Error(body.error ?? `Ping failed (${res.status})`);
      setMsg({
        kind: "ok",
        text: `Reached ${body.data?.model ?? "model"}.`,
      });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setPinging(false);
    }
  }

  async function clearKey(target: Provider): Promise<void> {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch("/api/ai/settings", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(
          target === "anthropic"
            ? { anthropicKey: null }
            : { openaiKey: null },
        ),
      });
      if (!res.ok) throw new Error(`Clear failed (${res.status})`);
      setMsg({ kind: "ok", text: "Key removed." });
      startTransition(() => router.refresh());
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="provider">Provider</Label>
          <select
            id="provider"
            value={provider}
            onChange={(e) => {
              const p = e.target.value as Provider;
              setProvider(p);
              if (model === defaultModels.anthropic || model === defaultModels.openai) {
                setModel(defaultModels[p]);
              }
            }}
            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-900/50 px-3 text-sm"
          >
            <option value="anthropic">Anthropic (Claude)</option>
            <option value="openai">OpenAI</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">Model</Label>
          <Input
            id="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={defaultModels[provider]}
          />
          <p className="text-xs text-zinc-500">
            Default: {defaultModels[provider]}
          </p>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="anthropic-key">Anthropic API key</Label>
        <Input
          id="anthropic-key"
          type="password"
          value={anthropicKey}
          onChange={(e) => setAnthropicKey(e.target.value)}
          placeholder={
            provider === "anthropic" && keyStatus.hasKey
              ? `set (${keyStatus.source}) — enter new value to replace`
              : "sk-ant-..."
          }
          autoComplete="off"
        />
        {provider === "anthropic" && keyStatus.hasKey && keyStatus.source === "settings" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearKey("anthropic")}
            disabled={saving}
          >
            Remove stored key
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="openai-key">OpenAI API key</Label>
        <Input
          id="openai-key"
          type="password"
          value={openaiKey}
          onChange={(e) => setOpenaiKey(e.target.value)}
          placeholder={
            provider === "openai" && keyStatus.hasKey
              ? `set (${keyStatus.source}) — enter new value to replace`
              : "sk-..."
          }
          autoComplete="off"
        />
        {provider === "openai" && keyStatus.hasKey && keyStatus.source === "settings" ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => clearKey("openai")}
            disabled={saving}
          >
            Remove stored key
          </Button>
        ) : null}
      </div>

      <div className="flex items-center gap-3">
        <Button onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </Button>
        <Button
          variant="outline"
          onClick={test}
          disabled={pinging || !keyStatus.hasKey}
          title={!keyStatus.hasKey ? "Save a key first" : undefined}
        >
          {pinging ? "Testing…" : "Test connection"}
        </Button>
        {msg ? (
          <span
            className={
              msg.kind === "ok"
                ? "text-sm text-emerald-400"
                : "text-sm text-red-400"
            }
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </div>
  );
}
