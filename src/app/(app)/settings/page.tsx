import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const SECTIONS = [
  {
    href: "/settings/accounts",
    title: "Connected accounts",
    description:
      "Connect Facebook, Instagram, TikTok, and YouTube. Tokens are encrypted on disk.",
    milestone: "M2",
  },
  {
    href: "/settings/ai",
    title: "AI captions",
    description:
      "Choose a provider (Anthropic / OpenAI), pick a model, and store the API key.",
    milestone: "M4",
  },
  {
    href: "/settings/general",
    title: "General",
    description:
      "Watch folder behavior, approval requirements, and other preferences.",
    milestone: "M3+",
  },
] as const;

export default function SettingsPage(): React.ReactElement {
  return (
    <>
      <PageHeader
        title="Settings"
        description="Configure platforms, AI, and runtime preferences."
      />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="transition-colors hover:border-zinc-700">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>{s.title}</CardTitle>
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs text-zinc-500">
                    {s.milestone}
                  </span>
                </div>
                <CardDescription>{s.description}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
    </>
  );
}
