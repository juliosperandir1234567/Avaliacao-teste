"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type Valor = string | number | null | undefined;
export type Direcao = "asc" | "desc";

/**
 * Ordenação por coluna (clique no cabeçalho) + busca por texto, tudo no navegador.
 * `colunas` diz como tirar o valor de cada coluna; `buscaEm` diz em quais textos a busca procura.
 */
export function useTabelaOrdenavel<T, K extends string>({
  linhas,
  colunas,
  buscaEm,
  inicial,
}: {
  linhas: T[];
  colunas: Record<K, (linha: T) => Valor>;
  buscaEm: (linha: T) => Valor[];
  inicial?: { coluna: NoInfer<K>; direcao: Direcao };
}) {
  const [ordem, setOrdem] = useState<{ coluna: K; direcao: Direcao } | null>(inicial ?? null);
  const [busca, setBusca] = useState("");

  const visiveis = useMemo(() => {
    const termo = normalizar(busca.trim());
    let lista = termo
      ? linhas.filter((l) => buscaEm(l).some((v) => v != null && normalizar(String(v)).includes(termo)))
      : linhas;
    if (ordem) {
      const pegar = colunas[ordem.coluna];
      const fator = ordem.direcao === "asc" ? 1 : -1;
      lista = [...lista].sort((a, b) => {
        const va = pegar(a);
        const vb = pegar(b);
        // Vazio sempre vai pro fim, nas duas direções.
        if (va == null || va === "") return vb == null || vb === "" ? 0 : 1;
        if (vb == null || vb === "") return -1;
        if (typeof va === "number" && typeof vb === "number") return (va - vb) * fator;
        return String(va).localeCompare(String(vb), "pt-BR", { numeric: true, sensitivity: "base" }) * fator;
      });
    }
    return lista;
    // colunas/buscaEm são funções estáveis por definição de quem chama (objeto literal) — só os dados importam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linhas, ordem, busca]);

  function alternar(coluna: K) {
    setOrdem((o) =>
      o?.coluna === coluna ? { coluna, direcao: o.direcao === "asc" ? "desc" : "asc" } : { coluna, direcao: "asc" }
    );
  }

  return { visiveis, ordem, alternar, busca, setBusca };
}

function normalizar(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Cabeçalho clicável: 1º clique crescente, 2º decrescente. */
export function ThOrdenavel<K extends string>({
  coluna,
  ordem,
  onClick,
  children,
  className = "px-3 py-2",
}: {
  coluna: K;
  ordem: { coluna: K; direcao: Direcao } | null;
  onClick: (coluna: K) => void;
  children: React.ReactNode;
  className?: string;
}) {
  const ativo = ordem?.coluna === coluna;
  const Icone = !ativo ? ArrowUpDown : ordem.direcao === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      className={`${className} font-medium`}
      aria-sort={ativo ? (ordem.direcao === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onClick(coluna)}
        className={`inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground ${ativo ? "text-foreground" : ""}`}
        title="Clique para ordenar"
      >
        {children}
        <Icone className={`size-3 ${ativo ? "" : "opacity-40"}`} />
      </button>
    </th>
  );
}

export function BuscaTabela({
  valor,
  onChange,
  placeholder = "Buscar por nome...",
  total,
  visiveis,
}: {
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  total: number;
  visiveis: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
      <div className="relative w-full max-w-xs">
        <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-8 pl-7 text-xs"
        />
      </div>
      {valor ? (
        <span className="text-xs text-muted-foreground">
          {visiveis} de {total}
        </span>
      ) : null}
    </div>
  );
}
