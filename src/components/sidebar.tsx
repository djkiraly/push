"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Calendar,
  CheckSquare,
  FileImage,
  LayoutDashboard,
  LogOut,
  PenSquare,
  Settings,
  TrendingUp,
} from "lucide-react";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/compose", label: "Compose", icon: PenSquare },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/approvals", label: "Approvals", icon: CheckSquare },
  { href: "/library", label: "Library", icon: FileImage },
  { href: "/analytics", label: "Analytics", icon: TrendingUp },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar(): React.ReactElement {
  const pathname = usePathname();

  async function logout(): Promise<void> {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-900 bg-zinc-950/60 p-4">
      <div className="mb-8 px-2">
        <div className="text-lg font-semibold tracking-tight">Push</div>
        <div className="text-xs text-zinc-500">Local scheduler</div>
      </div>

      <nav className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-zinc-900 text-zinc-100"
                  : "text-zinc-400 hover:bg-zinc-900/60 hover:text-zinc-100",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={logout}
        className="mt-4 flex items-center gap-3 rounded-md px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-zinc-900/60 hover:text-zinc-100"
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </button>
    </aside>
  );
}
