import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Push — Social Scheduler",
  description: "Local-first social media scheduler",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-zinc-950 text-zinc-100 antialiased">
        {children}
      </body>
    </html>
  );
}
