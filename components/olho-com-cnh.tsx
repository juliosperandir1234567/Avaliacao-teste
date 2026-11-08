"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Eye, Loader2 } from "lucide-react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";

// Cache por sessão: passar o mouse de novo na mesma linha não busca a URL outra vez.
const urlCache = new Map<string, string | null>();

/**
 * Envolve qualquer coisa (nome, ícone) e, ao passar o mouse, mostra a foto da CNH num cartão
 * flutuante. Posição "fixed" calculada pelo elemento, pra não ser cortada pela rolagem da tabela.
 */
export function CnhHover({
  fotoCnhPath,
  children,
  className = "inline-flex",
}: {
  fotoCnhPath: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [url, setUrl] = useState<string | null | undefined>(fotoCnhPath ? urlCache.get(fotoCnhPath) : null);
  const [carregou, setCarregou] = useState(false);

  async function abrir() {
    if (!ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const larg = 288;
    const alt = fotoCnhPath ? 200 : 40;
    const top = Math.max(8, Math.min(window.innerHeight - alt - 8, r.top + r.height / 2 - alt / 2));
    // Prefere abrir à direita do elemento; se não couber, à esquerda.
    const left = r.right + 8 + larg < window.innerWidth - 8 ? r.right + 8 : Math.max(8, r.left - larg - 8);
    setPos({ top, left });
    if (!fotoCnhPath) return;
    if (!urlCache.has(fotoCnhPath)) {
      const { data } = await createClient().storage.from("evidencias").createSignedUrl(fotoCnhPath, 60 * 30);
      urlCache.set(fotoCnhPath, data?.signedUrl ?? null);
      setUrl(data?.signedUrl ?? null);
    } else {
      setUrl(urlCache.get(fotoCnhPath));
    }
  }

  return (
    <span
      ref={ref}
      className={className}
      onMouseEnter={abrir}
      onMouseLeave={() => setPos(null)}
      onFocus={abrir}
      onBlur={() => setPos(null)}
    >
      {children}
      {pos && !fotoCnhPath ? (
        <span
          className="pointer-events-none fixed z-50 flex h-10 w-72 items-center justify-center rounded-lg border bg-background text-xs text-muted-foreground shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          Sem foto da CNH nesta avaliação
        </span>
      ) : null}
      {pos && fotoCnhPath ? (
        <span
          className="pointer-events-none fixed z-50 flex h-[200px] w-72 items-center justify-center overflow-hidden rounded-lg border bg-background p-1 shadow-xl"
          style={{ top: pos.top, left: pos.left }}
        >
          {url ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Foto da CNH"
                className={`max-h-full max-w-full object-contain ${carregou ? "" : "opacity-0"}`}
                onLoad={() => setCarregou(true)}
              />
              {!carregou ? <Loader2 className="absolute size-5 animate-spin text-muted-foreground" /> : null}
            </>
          ) : url === null ? (
            <span className="text-xs text-muted-foreground">Não foi possível carregar a CNH</span>
          ) : (
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          )}
        </span>
      ) : null}
    </span>
  );
}

/** Botão do olho (abre o PDF); passando o mouse mostra a CNH. */
export function OlhoComCnh({ href, fotoCnhPath }: { href: string; fotoCnhPath: string | null }) {
  return (
    <CnhHover fotoCnhPath={fotoCnhPath}>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label="Abrir PDF"
        render={
          <Link href={href} target="_blank">
            <Eye className="size-4" />
          </Link>
        }
      />
    </CnhHover>
  );
}
