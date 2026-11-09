"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export type DashboardParams = {
  dataInicio?: string;
  dataFim?: string;
  tipoPessoa?: string;
  avaliacaoId?: string;
  resultado?: string;
  funcao?: string;
  codigo?: string;
  cpfOuNome?: string;
};

const TODOS = "__todos";

/**
 * Filtros do Dashboard que aplicam sozinhos: listas e datas na hora, campos de texto
 * meio segundo depois de parar de digitar. Sem botão "Filtrar".
 */
export function DashboardFiltros({
  params,
  funcoes,
  avaliacoes,
}: {
  params: DashboardParams;
  funcoes: string[];
  avaliacoes: { id: string; nome: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [codigo, setCodigo] = useState(params.codigo ?? "");
  const [cpfOuNome, setCpfOuNome] = useState(params.cpfOuNome ?? "");
  // Último valor de texto que nós mesmos mandamos pra URL -- se a URL mudar por outro motivo
  // (card clicado, "Limpar"), os campos de texto acompanham; se fomos nós, não mexe no que está sendo digitado.
  const [enviado, setEnviado] = useState({ codigo: params.codigo ?? "", cpfOuNome: params.cpfOuNome ?? "" });
  const [dataInicio, setDataInicio] = useState(params.dataInicio ?? "");
  const [dataFim, setDataFim] = useState(params.dataFim ?? "");
  const [paramsAnteriores, setParamsAnteriores] = useState(params);
  if (paramsAnteriores !== params) {
    setParamsAnteriores(params);
    setDataInicio(params.dataInicio ?? "");
    setDataFim(params.dataFim ?? "");
    const novoCodigo = params.codigo ?? "";
    const novoCpf = params.cpfOuNome ?? "";
    if (novoCodigo !== enviado.codigo || novoCpf !== enviado.cpfOuNome) {
      if (novoCodigo !== enviado.codigo) setCodigo(novoCodigo);
      if (novoCpf !== enviado.cpfOuNome) setCpfOuNome(novoCpf);
      setEnviado({ codigo: novoCodigo, cpfOuNome: novoCpf });
    }
  }

  function aplicar(mudancas: Partial<DashboardParams>) {
    const novo: Record<string, string> = {};
    for (const [k, v] of Object.entries({ ...params, ...mudancas })) {
      if (v) novo[k] = v;
    }
    const qs = new URLSearchParams(novo).toString();
    startTransition(() => router.replace(qs ? `/dashboard?${qs}` : "/dashboard", { scroll: false }));
  }

  // Texto: espera parar de digitar.
  useEffect(() => {
    if (codigo === enviado.codigo && cpfOuNome === enviado.cpfOuNome) return;
    const t = setTimeout(() => {
      setEnviado({ codigo, cpfOuNome });
      aplicar({ codigo, cpfOuNome });
    }, 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, cpfOuNome]);

  const temFiltroAtivo = Object.values(params).some(Boolean);
  const select = (v: string | null) => (!v || v === TODOS ? undefined : v);

  return (
    <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4 lg:grid-cols-[repeat(7,minmax(0,1fr))_auto]">
      {/* Data: o campo só devolve valor quando a data está completa -- aplica nessa hora.
          Apagou a data? Aplica ao sair do campo. */}
      <Campo label="De">
        <Input
          type="date"
          value={dataInicio}
          onChange={(e) => {
            setDataInicio(e.target.value);
            if (e.target.value) aplicar({ dataInicio: e.target.value });
          }}
          onBlur={() => {
            if (!dataInicio && params.dataInicio) aplicar({ dataInicio: undefined });
          }}
          className="h-8 w-full text-xs"
        />
      </Campo>
      <Campo label="Até">
        <Input
          type="date"
          value={dataFim}
          onChange={(e) => {
            setDataFim(e.target.value);
            if (e.target.value) aplicar({ dataFim: e.target.value });
          }}
          onBlur={() => {
            if (!dataFim && params.dataFim) aplicar({ dataFim: undefined });
          }}
          className="h-8 w-full text-xs"
        />
      </Campo>
      <Campo label="Tipo">
        <Select
          items={{ [TODOS]: "Todos", interno: "Interno", externo: "Externo" }}
          value={params.tipoPessoa ?? TODOS}
          onValueChange={(v) => aplicar({ tipoPessoa: select(v as string | null) })}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todos</SelectItem>
            <SelectItem value="interno">Interno</SelectItem>
            <SelectItem value="externo">Externo</SelectItem>
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Função">
        <Select
          items={{ [TODOS]: "Todas", ...Object.fromEntries(funcoes.map((f) => [f, f])) }}
          value={params.funcao ?? TODOS}
          onValueChange={(v) => aplicar({ funcao: select(v as string | null) })}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {funcoes.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Avaliação">
        <Select
          items={{ [TODOS]: "Todas", ...Object.fromEntries(avaliacoes.map((a) => [a.id, a.nome])) }}
          value={params.avaliacaoId ?? TODOS}
          onValueChange={(v) => aplicar({ avaliacaoId: select(v as string | null) })}
        >
          <SelectTrigger className="h-8 w-full text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={TODOS}>Todas</SelectItem>
            {avaliacoes.map((a) => (
              <SelectItem key={a.id} value={a.id}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Campo>
      <Campo label="Código">
        <Input
          value={codigo}
          onChange={(e) => setCodigo(e.target.value)}
          placeholder="Matrícula"
          className="h-8 w-full text-xs"
        />
      </Campo>
      <Campo label="CPF ou Nome">
        <Input value={cpfOuNome} onChange={(e) => setCpfOuNome(e.target.value)} className="h-8 w-full text-xs" />
      </Campo>
      <div className="col-span-2 flex h-8 items-center gap-1 sm:col-span-1">
        {pending ? <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Filtrando" /> : null}
        {temFiltroAtivo ? (
          <Button size="sm" variant="ghost" className="h-8" render={<Link href="/dashboard">Limpar</Link>} />
        ) : null}
      </div>
    </div>
  );
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label className="text-[11px] text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
