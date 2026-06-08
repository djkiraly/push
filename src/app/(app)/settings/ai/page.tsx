import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getAiConfigStatus, DEFAULT_MODELS } from "@/lib/ai/providers";
import { AiSettingsForm } from "./ai-form";

export const dynamic = "force-dynamic";

export default async function AISettingsPage(): Promise<React.ReactElement> {
  const status = await getAiConfigStatus();

  return (
    <>
      <PageHeader
        title="AI captions"
        description="Provider, model, and API key for caption generation."
      />
      <Card>
        <CardHeader>
          <CardTitle>Provider</CardTitle>
          <CardDescription>
            Keys are AES-256-GCM encrypted in the local settings table. They
            never leave this machine except in outbound API calls.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AiSettingsForm
            initialProvider={status.provider}
            initialModel={status.model}
            defaultModels={DEFAULT_MODELS}
            keyStatus={{ source: status.keySource, hasKey: status.hasKey }}
          />
        </CardContent>
      </Card>
    </>
  );
}
