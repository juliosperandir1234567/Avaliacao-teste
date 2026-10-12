"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Menu, PenLine, X } from "lucide-react";
import { navItemsForRole, type NavItem } from "./nav-items";
import type { Profile } from "@/lib/types";
import { logout } from "@/app/(app)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
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

function fundoMenuStyle(menuFundoUrl: string | null) {
  return menuFundoUrl
    ? {
        // Camada escura por cima da foto pra manter o texto do menu legível.
        backgroundImage: `linear-gradient(rgba(0,0,0,0.45), rgba(0,0,0,0.45)), url("${menuFundoUrl}")`,
      }
    : undefined;
}

function classeItemMenu(active: boolean, comFundo: boolean) {
  return `flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
    active
      ? comFundo
        ? "bg-white text-foreground shadow-sm"
        : "bg-primary text-primary-foreground"
      : comFundo
        ? "text-white drop-shadow hover:bg-white/15"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
  }`;
}

/** Itens do menu lateral -- o mesmo conteúdo no notebook (fixo) e no celular (gaveta). */
function MenuLateral({
  items,
  ativoHref,
  comFundo,
  pendenciasCount,
  extras,
}: {
  items: NavItem[];
  ativoHref: string | null;
  comFundo: boolean;
  pendenciasCount: number;
  extras?: React.ReactNode;
}) {
  return (
    <>
      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link href={item.href} prefetch={false} className={classeItemMenu(item.href === ativoHref, comFundo)}>
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
        {extras}
      </ul>
      <form action={logout}>
        <button
          type="submit"
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${
            comFundo
              ? "border border-white/40 text-white drop-shadow hover:bg-white/15"
              : "text-muted-foreground hover:bg-muted hover:text-destructive"
          }`}
        >
          <LogOut className="size-4" /> Sair
        </button>
      </form>
    </>
  );
}

export function AppShell({
  profile,
  children,
  logoUrl,
  nomeEmpresa,
  menuFundoUrl = null,
  pendenciasCount = 0,
}: {
  profile: Profile;
  children: React.ReactNode;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  /** Imagem de fundo do menu lateral (Configurações). Com imagem, o menu fica escuro com texto branco. */
  menuFundoUrl?: string | null;
  pendenciasCount?: number;
}) {
  const pathname = usePathname();
  const items = navItemsForRole(profile.role);
  const ativoHref = hrefAtivo(pathname, items.map((i) => i.href));
  const comFundo = Boolean(menuFundoUrl);
  // Celular: menu em gaveta lateral aberta pelo botão ☰ do topo (antes era uma barra fixa embaixo).
  const [menuAberto, setMenuAberto] = useState(false);

  // Fecha a gaveta ao trocar de página.
  const [pathAnterior, setPathAnterior] = useState(pathname);
  if (pathAnterior !== pathname) {
    setPathAnterior(pathname);
    setMenuAberto(false);
  }

  useEffect(() => {
    if (!menuAberto) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuAberto(false);
    };
    const overflowAnterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = overflowAnterior;
      window.removeEventListener("keydown", onKey);
    };
  }, [menuAberto]);

  return (
    <div className="flex min-h-svh w-full flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b bg-background px-3 sm:px-4">
        <div className="flex min-w-0 items-center gap-1">
          <button
            type="button"
            aria-label="Abrir menu"
            className="relative -ml-1 flex size-10 shrink-0 items-center justify-center rounded-md hover:bg-muted md:hidden"
            onClick={() => setMenuAberto(true)}
          >
            <Menu className="size-5" />
            {pendenciasCount > 0 ? (
              <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-destructive-foreground">
                {pendenciasCount > 9 ? "9+" : pendenciasCount}
              </span>
            ) : null}
          </button>
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold text-sm sm:text-base">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt={nomeEmpresa ?? "Logo"} className="h-7 max-w-28 object-contain" />
            ) : null}
            <span className="truncate">{nomeEmpresa || "Avaliações Técnicas"}</span>
          </Link>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger className="flex shrink-0 items-center gap-2 text-sm">
            <span className="hidden sm:inline">{profile.nome}</span>
            <Badge variant="secondary">{ROLE_LABELS[profile.role]}</Badge>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {/* GroupLabel do Base UI quebra a página se ficar fora de um Menu.Group. */}
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col">
                  <span className="font-medium">{profile.nome}</span>
                  <span className="text-xs text-muted-foreground">{profile.email}</span>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              render={
                <Link href="/minha-assinatura" prefetch={false} className="flex w-full items-center gap-2">
                  <PenLine className="size-4" /> Minha assinatura
                </Link>
              }
            />
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
        <nav
          className={`sticky top-14 hidden h-[calc(100svh-3.5rem)] w-56 shrink-0 flex-col justify-between self-start overflow-y-auto border-r p-3 md:flex ${
            comFundo ? "bg-cover bg-center" : "bg-primary/10"
          }`}
          style={fundoMenuStyle(menuFundoUrl)}
        >
          <MenuLateral items={items} ativoHref={ativoHref} comFundo={comFundo} pendenciasCount={pendenciasCount} />
        </nav>

        <main className="min-w-0 flex-1 pb-6">
          <div className="mx-auto w-full max-w-screen-2xl p-3 sm:p-4 lg:px-6">{children}</div>
        </main>
      </div>

      {/* Mobile: gaveta lateral */}
      <div
        className={`fixed inset-0 z-50 md:hidden ${menuAberto ? "" : "pointer-events-none"}`}
        aria-hidden={!menuAberto}
        inert={!menuAberto}
      >
        <div
          className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${menuAberto ? "opacity-100" : "opacity-0"}`}
          onClick={() => setMenuAberto(false)}
        />
        <nav
          className={`absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-3 overflow-y-auto p-3 shadow-xl transition-transform duration-200 ${
            menuAberto ? "translate-x-0" : "-translate-x-full"
          } ${comFundo ? "bg-cover bg-center" : "bg-background"}`}
          style={fundoMenuStyle(menuFundoUrl)}
        >
          <div className={`flex items-center justify-between px-1 ${comFundo ? "text-white drop-shadow" : ""}`}>
            <div className="flex min-w-0 flex-col">
              <span className="truncate text-sm font-semibold">{profile.nome}</span>
              <span className={`text-xs ${comFundo ? "text-white/80" : "text-muted-foreground"}`}>
                {ROLE_LABELS[profile.role]}
              </span>
            </div>
            <button
              type="button"
              aria-label="Fechar menu"
              className={`flex size-9 items-center justify-center rounded-md ${comFundo ? "hover:bg-white/15" : "hover:bg-muted"}`}
              onClick={() => setMenuAberto(false)}
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="flex flex-1 flex-col justify-between gap-3">
            <MenuLateral
              items={items}
              ativoHref={ativoHref}
              comFundo={comFundo}
              pendenciasCount={pendenciasCount}
              extras={
                <li>
                  <Link
                    href="/minha-assinatura"
                    prefetch={false}
                    className={classeItemMenu(pathname === "/minha-assinatura", comFundo)}
                  >
                    <PenLine className="size-4" /> Minha assinatura
                  </Link>
                </li>
              }
            />
          </div>
        </nav>
      </div>
    </div>
  );
}
