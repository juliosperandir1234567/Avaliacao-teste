"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { navItemsForRole } from "./nav-items";
import type { Profile } from "@/lib/types";
import { logout } from "@/app/(app)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";

const ROLE_LABELS: Record<Profile["role"], string> = {
  admin: "Administrador",
  avaliador: "Avaliador",
  gestor: "Gestor",
  recrutamento: "Recrutamento",
};

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname.startsWith(href);
}

export function AppShell({
  profile,
  children,
  logoUrl,
  nomeEmpresa,
}: {
  profile: Profile;
  children: React.ReactNode;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(profile.role);

  return (
    <div className="flex min-h-svh w-full flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between border-b bg-background px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-sm sm:text-base">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={nomeEmpresa ?? "Logo"} className="h-7 max-w-28 object-contain" />
          ) : null}
          <span>{nomeEmpresa || "Avaliações Técnicas"}</span>
        </Link>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 text-sm">
            <span className="hidden sm:inline">{profile.nome}</span>
            <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col">
                <span className="font-medium">{profile.nome}</span>
                <span className="text-xs text-muted-foreground">{profile.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <form action={logout} className="w-full">
                  <button type="submit" className="flex w-full items-center gap-2">
                    <LogOut className="size-4" /> Sair
                  </button>
                </form>
              }
            />
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <div className="flex flex-1">
        {/* Desktop sidebar */}
        <nav className="hidden w-56 shrink-0 border-r bg-primary/10 p-3 md:block">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    prefetch={false}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <main className="flex-1 pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-5xl p-4">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-background md:hidden"
        style={{ gridTemplateColumns: `repeat(${Math.min(items.length, 5)}, minmax(0, 1fr))` }}
      >
        {items.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="size-5" />
              <span className="truncate px-1">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
