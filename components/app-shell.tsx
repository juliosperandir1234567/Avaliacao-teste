"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, MoreHorizontal } from "lucide-react";
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

/** Escolhe o item de menu ativo pelo href mais específico (mais longo) que bate com a
 * rota atual, pra evitar que "/dashboard" fique marcado junto de "/dashboard/exportar". */
function hrefAtivo(pathname: string, hrefs: string[]) {
  let melhor: string | null = null;
  for (const href of hrefs) {
    const bate = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
    if (bate && (!melhor || href.length > melhor.length)) melhor = href;
  }
  return melhor;
}

export function AppShell({
  profile,
  children,
  logoUrl,
  nomeEmpresa,
  pendenciasCount = 0,
}: {
  profile: Profile;
  children: React.ReactNode;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  pendenciasCount?: number;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(profile.role);
  const ativoHref = hrefAtivo(pathname, items.map((i) => i.href));
  const temMais = items.length > 5;
  const mobilePrincipais = temMais ? items.slice(0, 4) : items;
  const mobileMais = temMais ? items.slice(4) : [];
  const colunasMobile = mobilePrincipais.length + (mobileMais.length > 0 ? 1 : 0);

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
        <nav className="hidden w-56 shrink-0 flex-col justify-between border-r bg-primary/10 p-3 md:flex">
          <ul className="flex flex-col gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              const active = item.href === ativoHref;
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
                    <span className="relative">
                      <Icon className="size-4" />
                      {item.href === "/" && pendenciasCount > 0 ? (
                        <span className="absolute -right-1.5 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                          {pendenciasCount > 9 ? "9+" : pendenciasCount}
                        </span>
                      ) : null}
                    </span>
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <form action={logout}>
            <button
              type="submit"
              className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-destructive"
            >
              <LogOut className="size-4" /> Sair
            </button>
          </form>
        </nav>

        <main className="flex-1 pb-20 md:pb-6">
          <div className="mx-auto w-full max-w-5xl p-4">{children}</div>
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 grid border-t bg-background md:hidden"
        style={{ gridTemplateColumns: `repeat(${colunasMobile}, minmax(0, 1fr))` }}
      >
        {mobilePrincipais.map((item) => {
          const Icon = item.icon;
          const active = item.href === ativoHref;
          return (
            <Link
              key={item.href}
              href={item.href}
              prefetch={false}
              className={`flex flex-col items-center gap-1 py-2 text-[11px] font-medium ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <span className="relative">
                <Icon className="size-5" />
                {item.href === "/" && pendenciasCount > 0 ? (
                  <span className="absolute -right-2 -top-1.5 flex size-3.5 items-center justify-center rounded-full bg-destructive text-[8px] font-bold text-destructive-foreground">
                    {pendenciasCount > 9 ? "9+" : pendenciasCount}
                  </span>
                ) : null}
              </span>
              <span className="truncate px-1">{item.label}</span>
            </Link>
          );
        })}
        {mobileMais.length > 0 ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={`flex w-full flex-col items-center gap-1 py-2 text-[11px] font-medium ${
                mobileMais.some((item) => item.href === ativoHref) ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <MoreHorizontal className="size-5" />
              <span className="truncate px-1">Mais</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top">
              {mobileMais.map((item) => {
                const Icon = item.icon;
                const active = item.href === ativoHref;
                return (
                  <DropdownMenuItem
                    key={item.href}
                    render={
                      <Link
                        href={item.href}
                        prefetch={false}
                        className={`flex w-full items-center gap-2 ${active ? "text-primary" : ""}`}
                      >
                        <Icon className="size-4" />
                        {item.label}
                      </Link>
                    }
                  />
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </nav>
    </div>
  );
}
