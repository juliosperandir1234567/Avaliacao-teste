"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Eye } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  listarParaExportar,
  listarExportadas,
  limparExportacao,
  type FiltroExportacao,
} from "./actions";
import { PARECER_LABELS, type Parecer } from "@/lib/types";

interface LinhaAplicacao {
  id: string;
  data: string;
  tipo_pessoa: "interno" | "externo";
  colaborador_snapshot: { matricula: string; nome: string } | null;
  parecer_final: Parecer | null;
  exportado_em: string | null;
  avaliacoes: { nome: string } | { nome: string }[] | null;
  candidatos_externos: { nome: string } | { nome: string }[] | null;
}

function nomeDaLinha(l: LinhaAplicacao) {
  const externo = Array.isArray(l.candidatos_externos) ? l.candidatos_externos[0] : l.candidatos_externos;
  return l.colaborador_snapshot?.nome ?? externo?.nome ?? "Candidato externo";
}

function nomeAvaliacao(l: LinhaAplicacao) {
  const av = Array.isArray(l.avaliacoes) ? l.avaliacoes[0] : l.avaliacoes;
  return av?.nome ?? "-";
}

export function ExportarPainel({ avaliacoes }: { avaliacoes: { id: string; nome: string }[] }) {
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [avaliacaoId, setAvaliacaoId] = useState("");
  const [resultado, setResultado] = useState("");
  const [codigo, setCodigo] = useState("");
  const [cpfOuNome, setCpfOuNome] = useState("");
  const [incluirJaExportadas, setIncluirJaExportadas] = useState(false);

  const [previa, setPrevia] = useState<LinhaAplicacao[] | null>(null);
  const [exportadas, setExportadas] = useState<LinhaAplicacao[] | null>(null);
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const [selecionadasExportadas, setSelecionadasExportadas] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();
  const [baixando, setBaixando] = useState(false);

  function filtrosAtuais(): FiltroExportacao {
    return {
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      avaliacaoId: avaliacaoId || undefined,
      resultado: (resultado as Parecer) || undefined,
      codigo: codigo || undefined,
      cpfOuNome: cpfOuNome || undefined,
      incluirJaExportadas,
    };
  }

  function atualizarPrevia() {
    startTransition(async () => {
      const filtros = filtrosAtuais();
      const [p, e] = await Promise.all([listarParaExportar(filtros), listarExportadas(filtros)]);
      setPrevia(p as LinhaAplicacao[]);
      setExportadas(e as LinhaAplicacao[]);
      setSelecionadas(new Set());
      setSelecionadasExportadas(new Set());
    });
  }

  useEffect(() => {
    atualizarPrevia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function baixarZip() {
    if (selecionadas.size === 0) return;
    setBaixando(true);
    try {
      const res = await fetch("/aplicacoes/exportar-zip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [...selecionadas] }),
      });
      if (!res.ok) {
        const erro = await res.json().catch(() => null);
        toast.error(erro?.error ?? "Falha ao gerar o ZIP.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `avaliacoes-${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("ZIP baixado.");
      atualizarPrevia();
    } finally {
      setBaixando(false);
    }
  }

  function removerDasExportadas() {
    if (selecionadasExportadas.size === 0) return;
    startTransition(async () => {
      const result = await limparExportacao([...selecionadasExportadas]);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Removidas da lista de exportadas.");
      atualizarPrevia();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <Field label="De">
            <Input type="date" className="h-10" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
          </Field>
          <Field label="Até">
            <Input type="date" className="h-10" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
          </Field>
          <Field label="Avaliação">
            <Select value={avaliacaoId || "todas"} onValueChange={(v) => setAvaliacaoId(!v || v === "todas" ? "" : v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {avaliacoes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Resultado">
            <Select value={resultado || "todos"} onValueChange={(v) => setResultado(!v || v === "todos" ? "" : v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {Object.entries(PARECER_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Código">
            <Input className="h-10" value={codigo} onChange={(e) => setCodigo(e.target.value)} placeholder="Matrícula" />
          </Field>
          <Field label="CPF ou Nome">
            <Input className="h-10" value={cpfOuNome} onChange={(e) => setCpfOuNome(e.target.value)} />
          </Field>
          <div className="col-span-full flex items-end gap-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={incluirJaExportadas} onCheckedChange={(v) => setIncluirJaExportadas(Boolean(v))} />
              Incluir avaliações já exportadas anteriormente
            </label>
          </div>
          <div className="col-span-full">
            <Button type="button" variant="outline" disabled={pending} onClick={atualizarPrevia}>
              {pending ? "Atualizando..." : "Atualizar prévia"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {previa ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Prévia — {previa.length} avaliação(ões) para exportar</CardTitle>
            <Button type="button" disabled={selecionadas.size === 0 || baixando} onClick={baixarZip}>
              {baixando ? "Gerando..." : `Baixar ${selecionadas.size} em ZIP`}
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <TabelaAplicacoes
              linhas={previa}
              selecionadas={selecionadas}
              onToggle={(id, v) =>
                setSelecionadas((s) => {
                  const novo = new Set(s);
                  if (v) novo.add(id);
                  else novo.delete(id);
                  return novo;
                })
              }
              onToggleTodas={(v) => setSelecionadas(v ? new Set(previa.map((l) => l.id)) : new Set())}
            />
          </CardContent>
        </Card>
      ) : null}

      {exportadas && exportadas.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas exportações</CardTitle>
            <CardDescription>Respeitando os filtros selecionados acima.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 p-0">
            <div className="flex items-center justify-between px-4 pt-4">
              <span className="text-sm text-muted-foreground">
                {selecionadasExportadas.size} selecionada(s)
              </span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                disabled={selecionadasExportadas.size === 0 || pending}
                onClick={removerDasExportadas}
              >
                Excluir selecionadas
              </Button>
            </div>
            <TabelaAplicacoes
              linhas={exportadas}
              selecionadas={selecionadasExportadas}
              onToggle={(id, v) =>
                setSelecionadasExportadas((s) => {
                  const novo = new Set(s);
                  if (v) novo.add(id);
                  else novo.delete(id);
                  return novo;
                })
              }
              onToggleTodas={(v) => setSelecionadasExportadas(v ? new Set(exportadas.map((l) => l.id)) : new Set())}
              mostrarExportadoEm
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function TabelaAplicacoes({
  linhas,
  selecionadas,
  onToggle,
  onToggleTodas,
  mostrarExportadoEm,
}: {
  linhas: LinhaAplicacao[];
  selecionadas: Set<string>;
  onToggle: (id: string, v: boolean) => void;
  onToggleTodas: (v: boolean) => void;
  mostrarExportadoEm?: boolean;
}) {
  const todasMarcadas = linhas.length > 0 && linhas.every((l) => selecionadas.has(l.id));

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="w-10 px-4 py-2">
              <Checkbox checked={todasMarcadas} onCheckedChange={(v) => onToggleTodas(Boolean(v))} />
            </th>
            <th className="px-2 py-2 font-medium">Matrícula</th>
            <th className="px-2 py-2 font-medium">Colaborador</th>
            <th className="px-2 py-2 font-medium">Prova</th>
            <th className="px-2 py-2 font-medium">Resultado</th>
            {mostrarExportadoEm ? <th className="px-2 py-2 font-medium">Exportado em</th> : null}
            <th className="px-2 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {linhas.length === 0 ? (
            <tr>
              <td colSpan={mostrarExportadoEm ? 7 : 6} className="px-4 py-6 text-center text-muted-foreground">
                Nenhuma avaliação encontrada.
              </td>
            </tr>
          ) : (
            linhas.map((l) => (
              <tr key={l.id} className="hover:bg-muted/40">
                <td className="px-4 py-2">
                  <Checkbox checked={selecionadas.has(l.id)} onCheckedChange={(v) => onToggle(l.id, Boolean(v))} />
                </td>
                <td className="px-2 py-2">{l.colaborador_snapshot?.matricula ?? "-"}</td>
                <td className="px-2 py-2 font-medium">{nomeDaLinha(l)}</td>
                <td className="px-2 py-2">{nomeAvaliacao(l)}</td>
                <td className="px-2 py-2">
                  {l.parecer_final ? <Badge variant="secondary">{PARECER_LABELS[l.parecer_final]}</Badge> : "-"}
                </td>
                {mostrarExportadoEm ? (
                  <td className="px-2 py-2 text-xs text-muted-foreground">
                    {l.exportado_em ? new Date(l.exportado_em).toLocaleString("pt-BR") : "-"}
                  </td>
                ) : null}
                <td className="px-2 py-2">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={
                      <Link href={`/aplicacoes/${l.id}/relatorio`} target="_blank">
                        <Eye className="size-4" />
                      </Link>
                    }
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
