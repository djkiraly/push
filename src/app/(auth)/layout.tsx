export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 p-6">
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
