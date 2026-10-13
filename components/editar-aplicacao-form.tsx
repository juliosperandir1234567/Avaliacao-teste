"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QuestionInput } from "@/components/question-input";
import { PerguntaImagem } from "@/components/pergunta-imagem";
import { ChecklistTable } from "@/components/checklist-table";
import { createClient } from "@/utils/supabase/client";
import { salvarEdicaoAplicacao } from "@/app/(app)/aplicacoes/actions";
import { calcularNotaGeral, precisaCorrecaoManual } from "@/lib/scoring";
import { condicaoAtendida } from "@/lib/conditional";
import { PARECER_LABELS, PERGUNTA_TIPO_LABELS } from "@/lib/types";
import type {
  AvaliacaoAlternativa,
  AvaliacaoPergunta,
  AvaliacaoSecao,
  ChecklistStatus,
  Parecer,
  Resposta,
  RespostaValor,
} from "@/lib/types";

interface RespostaLocal {
  valor: RespostaValor;
  observacao: string;
  pontuacaoManual: number | null;
  evidencias: string[];
}

type Bloco = { tipo: "unico"; pergunta: AvaliacaoPergunta } | { tipo: "checklist"; perguntas: AvaliacaoPergunta[] };

/** Mesmo agrupamento do runner: checklists consecutivos da mesma seção viram uma tabela só. */
function agruparBlocos(perguntas: AvaliacaoPergunta[]): Bloco[] {
  const blocos: Bloco[] = [];
  let grupo: AvaliacaoPergunta[] = [];
  const flush = () => {
    if (grupo.length > 0) blocos.push({ tipo: "checklist", perguntas: grupo });
    grupo = [];
  };
  for (const p of perguntas) {
    if (p.tipo === "checklist") {
      if (grupo.length > 0 && grupo[0].secao_id !== p.secao_id) flush();
      grupo.push(p);
    } else {
      flush();
      blocos.push({ tipo: "unico", pergunta: p });
    }
  }
  flush();
  return blocos;
}

export function EditarAplicacaoForm({
  aplicacaoId,
  tituloAvaliacao,
  pessoaNome,
  secoes,
  perguntas,
  alternativas,
  respostasIniciais,
  parecerInicial,
  observacaoInicial,
}: {
  aplicacaoId: string;
  tituloAvaliacao: string;
  pessoaNome: string;
  secoes: AvaliacaoSecao[];
  perguntas: AvaliacaoPergunta[];
  alternativas: AvaliacaoAlternativa[];
  respostasIniciais: Resposta[];
  parecerInicial: Parecer;
  observacaoInicial: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const secaoPorId = useMemo(() => new Map(secoes.map((s) => [s.id, s])), [secoes]);
  const perguntasOrdenadas = useMemo(
    () =>
      [...perguntas].sort((a, b) => {
        const sa = secaoPorId.get(a.secao_id)?.ordem ?? 0;
        const sb = secaoPorId.get(b.secao_id)?.ordem ?? 0;
        return sa !== sb ? sa - sb : a.ordem - b.ordem;
      }),
    [perguntas, secaoPorId]
  );
  const perguntasPorId = useMemo(() => new Map(perguntas.map((p) => [p.id, p])), [perguntas]);
  const alternativasPorPergunta = useMemo(() => {
    const map = new Map<string, AvaliacaoAlternativa[]>();
    for (const a of alternativas) map.set(a.pergunta_id, [...(map.get(a.pergunta_id) ?? []), a]);
    return map;
  }, [alternativas]);

  const [respostas, setRespostas] = useState<Record<string, RespostaLocal>>(() => {
    const initial: Record<string, RespostaLocal> = {};
    for (const r of respostasIniciais) {
      if (r.resposta) {
        initial[r.pergunta_id] = {
          valor: r.resposta,
          observacao: r.observacao ?? "",
          pontuacaoManual: r.pontuacao,
          evidencias: r.evidencias,
        };
      }
    }
    return initial;
  });
  // Só as perguntas mexidas vão pro servidor ao salvar.
  const [alteradas, setAlteradas] = useState<Set<string>>(new Set());
  const [parecer, setParecer] = useState<Parecer>(parecerInicial);
  const [observacao, setObservacao] = useState(observacaoInicial);

  function atualizar(perguntaId: string, nova: RespostaLocal) {
    setRespostas((prev) => ({ ...prev, [perguntaId]: nova }));
    setAlteradas((prev) => new Set(prev).add(perguntaId));
  }

  const valorPorPergunta = useMemo(() => {
    const map = new Map<string, RespostaValor | null | undefined>();
    for (const [id, r] of Object.entries(respostas)) map.set(id, r.valor);
    return map;
  }, [respostas]);

  const perguntasVisiveis = useMemo(
    () => perguntasOrdenadas.filter((p) => condicaoAtendida(p, perguntasPorId, valorPorPergunta)),
    [perguntasOrdenadas, perguntasPorId, valorPorPergunta]
  );
  const blocos = useMemo(() => agruparBlocos(perguntasVisiveis), [perguntasVisiveis]);

  const notaOriginal = useMemo(
    () => calcularNotaGeral(secoes, perguntas, respostasIniciais),
    [secoes, perguntas, respostasIniciais]
  );
  // Mesmas opções do fechamento da prova (runner); mantém o parecer atual se for outro.
  const opcoesParecer = useMemo(() => {
    const valores: Parecer[] = ["apto", "reprovado"];
    if (!valores.includes(parecerInicial)) valores.push(parecerInicial);
    return Object.fromEntries(valores.map((v) => [v, PARECER_LABELS[v]])) as Record<string, string>;
  }, [parecerInicial]);

  async function handleEvidencia(perguntaId: string, file: File) {
    const supabase = createClient();
    const path = `${aplicacaoId}/${perguntaId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file);
    if (error) {
      toast.error("Falha ao enviar evidência: " + error.message);
      return;
    }
    const atual = respostas[perguntaId] ?? {
      valor: { status: "nao_avaliado" } as RespostaValor,
      observacao: "",
      pontuacaoManual: null,
      evidencias: [],
    };
    atualizar(perguntaId, { ...atual, evidencias: [...atual.evidencias, path] });
    toast.success("Evidência anexada (será gravada ao salvar)");
  }

  function salvar() {
    const visiveis = new Set(perguntasVisiveis.map((p) => p.id));
    const payload = [...alteradas]
      .filter((id) => visiveis.has(id) && respostas[id])
      .map((id) => ({ perguntaId: id, ...respostas[id] }));
    const removerPerguntaIds = respostasIniciais
      .map((r) => r.pergunta_id)
      .filter((id) => !visiveis.has(id));

    startTransition(async () => {
      const result = await salvarEdicaoAplicacao({
        aplicacaoId,
        respostas: payload,
        removerPerguntaIds,
        parecerFinal: parecer,
        observacao,
      });
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Prova atualizada");
      router.push(`/aplicacoes/${aplicacaoId}/raiox`);
    });
  }

  return (
    <div className="flex w-full flex-col gap-4 pb-8">
      <Card className="border-amber-300 bg-amber-50/60 dark:bg-amber-950/20">
        <CardContent className="flex flex-col gap-1 pt-4 text-sm">
          <p className="font-semibold">Editando prova finalizada</p>
          <p className="text-muted-foreground">
            {pessoaNome} · {tituloAvaliacao}
          </p>
          <p className="text-xs text-muted-foreground">
            Nada é gravado até clicar em <strong>Salvar alterações</strong>. A nota é recalculada ao salvar.
            {notaOriginal !== null ? ` Nota atual: ${notaOriginal.toFixed(1)}.` : ""}
          </p>
        </CardContent>
      </Card>

      {blocos.map((bloco, i) => {
        const secaoId = secaoDoBloco(bloco)!;
        const titulo =
          secaoId !== secaoDoBloco(blocos[i - 1]) ? (
            <h2 className="pt-2 text-sm font-semibold text-muted-foreground">{secaoPorId.get(secaoId)?.nome}</h2>
          ) : null;

        if (bloco.tipo === "checklist") {
          const respostaPorPergunta = new Map(
            bloco.perguntas.map((p) => [
              p.id,
              respostas[p.id]
                ? { valor: respostas[p.id].valor, observacao: respostas[p.id].observacao, evidencias: respostas[p.id].evidencias }
                : undefined,
            ])
          );
          return (
            <div key={bloco.perguntas[0].id} className="flex flex-col gap-2">
              {titulo}
              <ChecklistTable
                perguntas={bloco.perguntas}
                escala={secaoPorId.get(secaoId)?.escala_checklist ?? "sim_nao"}
                respostaPorPergunta={respostaPorPergunta}
                onSetStatus={(id, status: ChecklistStatus) =>
                  atualizar(id, {
                    valor: { status },
                    observacao: respostas[id]?.observacao ?? "",
                    pontuacaoManual: null,
                    evidencias: respostas[id]?.evidencias ?? [],
                  })
                }
                onSetObservacao={(id, texto) =>
                  atualizar(id, {
                    ...(respostas[id] ?? {
                      valor: { status: "nao_avaliado" } as RespostaValor,
                      pontuacaoManual: null,
                      evidencias: [],
                    }),
                    observacao: texto,
                  })
                }
                onUploadEvidencia={handleEvidencia}
              />
            </div>
          );
        }

        const pergunta = bloco.pergunta;
        const atual = respostas[pergunta.id];
        return (
          <div key={pergunta.id} className="flex flex-col gap-2">
            {titulo}
            <Card>
              <CardHeader className="pb-2">
                <Badge variant="outline" className="w-fit text-xs">
                  {PERGUNTA_TIPO_LABELS[pergunta.tipo]}
                </Badge>
                <CardTitle className="text-base font-medium">{pergunta.enunciado}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {pergunta.config.imagem_path ? <PerguntaImagem path={pergunta.config.imagem_path} /> : null}
                <QuestionInput
                  pergunta={pergunta}
                  alternativas={alternativasPorPergunta.get(pergunta.id) ?? []}
                  value={atual?.valor}
                  onChange={(valor) =>
                    atualizar(pergunta.id, {
                      valor,
                      observacao: atual?.observacao ?? "",
                      pontuacaoManual: atual?.pontuacaoManual ?? null,
                      evidencias: atual?.evidencias ?? [],
                    })
                  }
                />
                {precisaCorrecaoManual(pergunta) ? (
                  <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Nota do avaliador (0 a 10)</Label>
                    <Input
                      type="number"
                      min={0}
                      max={10}
                      step={0.5}
                      className="h-10 w-32"
                      value={atual?.pontuacaoManual ?? ""}
                      onChange={(e) => {
                        if (!atual) return;
                        const v = e.target.value === "" ? null : Number(e.target.value);
                        atualizar(pergunta.id, { ...atual, pontuacaoManual: v });
                      }}
                    />
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </div>
        );
      })}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parecer e observação</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <div className="flex flex-col gap-1.5">
            <Label>Parecer final</Label>
            <Select
              items={opcoesParecer}
              value={parecer}
              onValueChange={(v) => setParecer(v as Parecer)}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(opcoesParecer).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="observacaoEdicao">Observação do avaliador</Label>
            <Textarea id="observacaoEdicao" value={observacao} onChange={(e) => setObservacao(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={pending} onClick={() => router.back()}>
          Cancelar
        </Button>
        <Button disabled={pending} onClick={salvar}>
          {pending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </div>
  );
}

function secaoDoBloco(bloco: Bloco | undefined) {
  if (!bloco) return null;
  return bloco.tipo === "checklist" ? bloco.perguntas[0].secao_id : bloco.pergunta.secao_id;
}
