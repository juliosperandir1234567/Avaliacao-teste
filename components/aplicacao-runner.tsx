"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress as ProgressBar } from "@/components/ui/progress";
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
import { SignaturePad } from "@/components/signature-pad";
import { ChecklistTable } from "@/components/checklist-table";
import { createClient } from "@/utils/supabase/client";
import {
  finalizarAplicacao,
  interromperPorSeguranca,
  salvarResposta,
} from "@/app/(app)/aplicacoes/actions";
import {
  avaliarItensCriticos,
  calcularNotaGeral,
  calcularNotasPorCompetencia,
  gerarParecerSugerido,
  precisaCorrecaoManual,
} from "@/lib/scoring";
import { condicaoAtendida } from "@/lib/conditional";
import { PARECER_LABELS, PERGUNTA_TIPO_LABELS } from "@/lib/types";
import type {
  AvaliacaoAlternativa,
  AvaliacaoCompetencia,
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
  pontuacao: number | null;
}

type Passo = { tipo: "unico"; pergunta: AvaliacaoPergunta } | { tipo: "checklist"; perguntas: AvaliacaoPergunta[] };

function agruparPassos(perguntas: AvaliacaoPergunta[]): Passo[] {
  const passos: Passo[] = [];
  let grupo: AvaliacaoPergunta[] = [];

  function flush() {
    if (grupo.length > 0) {
      passos.push({ tipo: "checklist", perguntas: grupo });
      grupo = [];
    }
  }

  for (const p of perguntas) {
    if (p.tipo === "checklist") {
      if (grupo.length > 0 && grupo[0].secao_id !== p.secao_id) flush();
      grupo.push(p);
    } else {
      flush();
      passos.push({ tipo: "unico", pergunta: p });
    }
  }
  flush();
  return passos;
}

export function AplicacaoRunner({
  aplicacaoId,
  tituloAvaliacao,
  pessoaNome,
  pessoaDetalhes,
  secoes,
  perguntas,
  alternativas,
  respostasIniciais,
  notaMinima,
  competencias,
}: {
  aplicacaoId: string;
  tituloAvaliacao: string;
  pessoaNome: string;
  pessoaDetalhes: { label: string; value: string }[];
  secoes: AvaliacaoSecao[];
  perguntas: AvaliacaoPergunta[];
  alternativas: AvaliacaoAlternativa[];
  respostasIniciais: Resposta[];
  notaMinima: number;
  competencias: AvaliacaoCompetencia[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const secaoPorId = useMemo(() => new Map(secoes.map((s) => [s.id, s])), [secoes]);
  const perguntasOrdenadas = useMemo(
    () =>
      [...perguntas].sort((a, b) => {
        const sa = secaoPorId.get(a.secao_id)?.ordem ?? 0;
        const sb = secaoPorId.get(b.secao_id)?.ordem ?? 0;
        if (sa !== sb) return sa - sb;
        return a.ordem - b.ordem;
      }),
    [perguntas, secaoPorId]
  );

  const alternativasPorPergunta = useMemo(() => {
    const map = new Map<string, AvaliacaoAlternativa[]>();
    for (const a of alternativas) {
      const list = map.get(a.pergunta_id) ?? [];
      list.push(a);
      map.set(a.pergunta_id, list);
    }
    return map;
  }, [alternativas]);

  const perguntasPorId = useMemo(() => new Map(perguntas.map((p) => [p.id, p])), [perguntas]);

  const [respostas, setRespostas] = useState<Record<string, RespostaLocal>>(() => {
    const initial: Record<string, RespostaLocal> = {};
    for (const r of respostasIniciais) {
      if (r.resposta) {
        initial[r.pergunta_id] = {
          valor: r.resposta,
          observacao: r.observacao ?? "",
          pontuacaoManual: r.pontuacao,
          evidencias: r.evidencias,
          pontuacao: r.pontuacao,
        };
      }
    }
    return initial;
  });

  const [index, setIndex] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [mostrarResumo, setMostrarResumo] = useState(false);
  const [mostrarInterromper, setMostrarInterromper] = useState(false);
  const [motivoInterrupcao, setMotivoInterrupcao] = useState("");
  const [assinaturaAvaliadoPath, setAssinaturaAvaliadoPath] = useState<string | null>(null);
  const [assinaturaAvaliadorPath, setAssinaturaAvaliadorPath] = useState<string | null>(null);
  const [observacaoFinal, setObservacaoFinal] = useState("");
  const [parecerEscolhido, setParecerEscolhido] = useState<Parecer | null>(null);
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false);
  const saveTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  async function capturarAssinatura(quem: "avaliado" | "avaliador", blob: Blob) {
    setEnviandoAssinatura(true);
    const supabase = createClient();
    const path = `${aplicacaoId}/${quem}-${Date.now()}.png`;
    const { error } = await supabase.storage.from("assinaturas").upload(path, blob, {
      contentType: "image/png",
    });
    setEnviandoAssinatura(false);
    if (error) {
      toast.error("Falha ao salvar assinatura: " + error.message);
      return;
    }
    if (quem === "avaliado") setAssinaturaAvaliadoPath(path);
    else setAssinaturaAvaliadorPath(path);
  }

  const respostaValorPorPergunta = useMemo(() => {
    const map = new Map<string, RespostaValor | null | undefined>();
    for (const [perguntaId, r] of Object.entries(respostas)) map.set(perguntaId, r.valor);
    return map;
  }, [respostas]);

  const perguntasVisiveis = useMemo(
    () => perguntasOrdenadas.filter((p) => condicaoAtendida(p, perguntasPorId, respostaValorPorPergunta)),
    [perguntasOrdenadas, perguntasPorId, respostaValorPorPergunta]
  );

  const passos = useMemo(() => agruparPassos(perguntasVisiveis), [perguntasVisiveis]);

  const totalItens = perguntasVisiveis.length;
  const respondidas = perguntasVisiveis.filter((p) => respostas[p.id]).length;
  const totalPassos = passos.length;
  const indiceSeguro = Math.min(index, Math.max(0, totalPassos - 1));
  const passoAtual = passos[indiceSeguro];
  const progresso = totalPassos > 0 ? Math.round(((indiceSeguro + 1) / totalPassos) * 100) : 0;

  function persistir(perguntaId: string, novaResposta: RespostaLocal, imediato = false) {
    setRespostas((prev) => ({ ...prev, [perguntaId]: novaResposta }));
    if (saveTimer.current[perguntaId]) clearTimeout(saveTimer.current[perguntaId]);
    const executar = async () => {
      setSaveStatus("saving");
      const result = await salvarResposta({
        aplicacaoId,
        perguntaId,
        valor: novaResposta.valor,
        observacao: novaResposta.observacao,
        pontuacaoManual: novaResposta.pontuacaoManual,
        evidencias: novaResposta.evidencias,
      });
      if (result.error) {
        toast.error(result.error);
        setSaveStatus("idle");
        return;
      }
      setRespostas((prev) => ({
        ...prev,
        [perguntaId]: { ...novaResposta, pontuacao: result.pontuacao ?? null },
      }));
      setSaveStatus("saved");
    };
    if (imediato) executar();
    else saveTimer.current[perguntaId] = setTimeout(executar, 500);
  }

  async function handleEvidencia(perguntaId: string, file: File) {
    const supabase = createClient();
    const path = `${aplicacaoId}/${perguntaId}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file);
    if (error) {
      toast.error("Falha ao enviar evidência: " + error.message);
      return;
    }
    const atual = respostas[perguntaId];
    const base: RespostaLocal = atual ?? {
      valor: { texto: "" } as RespostaValor,
      observacao: "",
      pontuacaoManual: null,
      evidencias: [],
      pontuacao: null,
    };
    persistir(perguntaId, { ...base, evidencias: [...base.evidencias, path] }, true);
    toast.success("Evidência anexada");
  }

  function setChecklistStatus(perguntaId: string, status: ChecklistStatus) {
    const atual = respostas[perguntaId];
    persistir(
      perguntaId,
      {
        valor: { status },
        observacao: atual?.observacao ?? "",
        pontuacaoManual: null,
        evidencias: atual?.evidencias ?? [],
        pontuacao: null,
      },
      true
    );
  }

  function setChecklistObservacao(perguntaId: string, texto: string) {
    const atual = respostas[perguntaId];
    const base: RespostaLocal = atual ?? {
      valor: { status: "nao_avaliado" } as RespostaValor,
      observacao: "",
      pontuacaoManual: null,
      evidencias: [],
      pontuacao: null,
    };
    persistir(perguntaId, { ...base, observacao: texto });
  }

  if (!passoAtual) {
    return <p className="text-center text-muted-foreground">Esta avaliação não possui perguntas.</p>;
  }

  if (mostrarResumo) {
    const respostasComoResposta: Resposta[] = perguntasVisiveis
      .filter((p) => respostas[p.id])
      .map((p) => ({
        id: p.id,
        aplicacao_id: aplicacaoId,
        pergunta_id: p.id,
        tipo: p.tipo,
        resposta: respostas[p.id].valor,
        correta: null,
        pontuacao: respostas[p.id].pontuacao,
        observacao: respostas[p.id].observacao || null,
        evidencias: respostas[p.id].evidencias,
        item_critico_falhou: p.item_critico && respostas[p.id].pontuacao === 0,
      }));

    const notaPreliminar = calcularNotaGeral(secoes, perguntasVisiveis, respostasComoResposta);
    const falhasCriticas = avaliarItensCriticos(perguntasVisiveis, respostasComoResposta);
    const naoAvaliados = totalItens - respondidas;
    const notasPorCompetencia = calcularNotasPorCompetencia(competencias, perguntasVisiveis, respostasComoResposta);
    const parecerSugerido = gerarParecerSugerido({
      notaGeral: notaPreliminar,
      notaMinima,
      competencias,
      notasPorCompetencia,
      falhasCriticas,
    });
    const parecerFinal = parecerEscolhido ?? parecerSugerido;

    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Itens" value={String(totalItens)} />
            <Row label="Respondidos" value={String(respondidas)} />
            <Row label="Não avaliados" value={String(naoAvaliados)} />
            <Row label="Falhas críticas" value={String(falhasCriticas.length)} highlight={falhasCriticas.length > 0} />
            <Row label="Nota preliminar" value={notaPreliminar !== null ? notaPreliminar.toFixed(1) : "-"} />

            <div className="flex flex-col gap-1.5 border-t pt-3">
              <Label>Parecer final</Label>
              <Select
                items={{ apto: PARECER_LABELS.apto, reprovado: PARECER_LABELS.reprovado }}
                value={parecerFinal === "reprovado" ? "reprovado" : "apto"}
                onValueChange={(v) => setParecerEscolhido(v as Parecer)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="apto">{PARECER_LABELS.apto}</SelectItem>
                  <SelectItem value="reprovado">{PARECER_LABELS.reprovado}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="observacaoFinal">Observação final</Label>
              <Textarea
                id="observacaoFinal"
                value={observacaoFinal}
                onChange={(e) => setObservacaoFinal(e.target.value)}
                placeholder="Justificativa/observações para o parecer final"
              />
            </div>

            <div className="flex flex-col gap-4 border-t pt-3 sm:flex-row">
              <SignaturePad
                label="Assinatura do avaliado"
                captured={Boolean(assinaturaAvaliadoPath)}
                onCapture={(blob) => capturarAssinatura("avaliado", blob)}
              />
              <SignaturePad
                label="Assinatura do avaliador"
                captured={Boolean(assinaturaAvaliadorPath)}
                onCapture={(blob) => capturarAssinatura("avaliador", blob)}
              />
            </div>

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setMostrarResumo(false)}>
                Revisar
              </Button>
              <Button
                disabled={
                  pending ||
                  enviandoAssinatura ||
                  !assinaturaAvaliadoPath ||
                  !assinaturaAvaliadorPath
                }
                onClick={() =>
                  startTransition(async () => {
                    const result = await finalizarAplicacao(
                      aplicacaoId,
                      {
                        avaliadoPath: assinaturaAvaliadoPath ?? undefined,
                        avaliadorPath: assinaturaAvaliadorPath ?? undefined,
                      },
                      false,
                      observacaoFinal.trim() || undefined,
                      parecerFinal ?? undefined
                    );
                    if (result?.error) {
                      toast.error(result.error);
                      return;
                    }
                    if (result.precisaAprovacao) {
                      toast.success("Avaliação enviada para aprovação de um avaliador.");
                    } else {
                      window.open(`/aplicacoes/${aplicacaoId}/relatorio`, "_blank");
                    }
                    router.push(`/aplicacoes/${aplicacaoId}/raiox`);
                  })
                }
              >
                {pending ? "Finalizando..." : "Finalizar Avaliação"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const cabecalho = (
    <>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Passo {indiceSeguro + 1} de {totalPassos}
            {passoAtual.tipo === "checklist" ? ` — checklist (${passoAtual.perguntas.length} itens)` : ""} —{" "}
            {progresso}% concluído
          </span>
          <span>{saveStatus === "saving" ? "Salvando..." : saveStatus === "saved" ? "Salvo" : ""}</span>
        </div>
        <ProgressBar value={progresso} />
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-sm font-medium text-muted-foreground">{tituloAvaliacao}</h1>
        <Button variant="ghost" size="sm" className="text-destructive" onClick={() => setMostrarInterromper(true)}>
          <ShieldAlert className="size-4" /> Interromper por segurança
        </Button>
      </div>

      <div className="rounded-md border bg-muted/20 p-2.5 text-xs">
        <p className="font-semibold text-sm">{pessoaNome}</p>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
          {pessoaDetalhes
            .filter((d) => d.value && d.value !== "-")
            .map((d) => (
              <span key={d.label}>
                {d.label}: {d.value}
              </span>
            ))}
        </p>
      </div>

      {mostrarInterromper ? (
        <Card className="border-destructive">
          <CardContent className="flex flex-col gap-2 pt-4">
            <Label>Motivo da interrupção</Label>
            <Textarea value={motivoInterrupcao} onChange={(e) => setMotivoInterrupcao(e.target.value)} />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setMostrarInterromper(false)}>
                Cancelar
              </Button>
              <Button
                variant="destructive"
                disabled={!motivoInterrupcao.trim() || pending}
                onClick={() =>
                  startTransition(async () => {
                    const result = await interromperPorSeguranca(aplicacaoId, motivoInterrupcao);
                    if (result?.error) {
                      toast.error(result.error);
                      return;
                    }
                    if (result.precisaAprovacao) {
                      toast.success("Avaliação enviada para aprovação de um avaliador.");
                    } else {
                      window.open(`/aplicacoes/${aplicacaoId}/relatorio`, "_blank");
                    }
                    router.push(`/aplicacoes/${aplicacaoId}/raiox`);
                  })
                }
              >
                Confirmar Interrupção
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </>
  );

  const navegacao = (
    <div className="flex justify-between gap-2 pb-4">
      <Button variant="outline" disabled={indiceSeguro === 0} onClick={() => setIndex(Math.max(0, indiceSeguro - 1))}>
        Anterior
      </Button>
      {indiceSeguro === totalPassos - 1 ? (
        <Button onClick={() => setMostrarResumo(true)}>Revisar e Finalizar</Button>
      ) : (
        <Button onClick={() => setIndex(Math.min(totalPassos - 1, indiceSeguro + 1))}>Próxima</Button>
      )}
    </div>
  );

  if (passoAtual.tipo === "checklist") {
    const respostaPorPergunta = new Map(
      passoAtual.perguntas.map((p) => [
        p.id,
        respostas[p.id]
          ? { valor: respostas[p.id].valor, observacao: respostas[p.id].observacao, evidencias: respostas[p.id].evidencias }
          : undefined,
      ])
    );

    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-3">
        {cabecalho}
        <ChecklistTable
          perguntas={passoAtual.perguntas}
          escala={secaoPorId.get(passoAtual.perguntas[0].secao_id)?.escala_checklist ?? "sim_nao"}
          respostaPorPergunta={respostaPorPergunta}
          onSetStatus={setChecklistStatus}
          onSetObservacao={setChecklistObservacao}
          onUploadEvidencia={handleEvidencia}
        />
        {navegacao}
      </div>
    );
  }

  const pergunta = passoAtual.pergunta;
  const respostaAtual = respostas[pergunta.id];
  const precisaManual = precisaCorrecaoManual(pergunta);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-3">
      {cabecalho}

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
            value={respostaAtual?.valor}
            onChange={(valor) =>
              persistir(pergunta.id, {
                valor,
                observacao: respostaAtual?.observacao ?? "",
                pontuacaoManual: respostaAtual?.pontuacaoManual ?? null,
                evidencias: respostaAtual?.evidencias ?? [],
                pontuacao: null,
              })
            }
          />

          {precisaManual ? (
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Nota do avaliador (0 a 10)</Label>
              <Input
                type="number"
                min={0}
                max={10}
                step={0.5}
                className="h-10 w-32"
                value={respostaAtual?.pontuacaoManual ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  if (!respostaAtual) return;
                  persistir(pergunta.id, { ...respostaAtual, pontuacaoManual: v }, true);
                }}
              />
            </div>
          ) : null}

          <div className="flex flex-col gap-1.5">
            <Label className="flex items-center gap-1 text-xs">
              <Camera className="size-3.5" /> Evidência{pergunta.evidencia_obrigatoria ? " (obrigatória)" : ""}
            </Label>
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              className="h-11"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleEvidencia(pergunta.id, file);
              }}
            />
            {respostaAtual?.evidencias.length ? (
              <p className="text-xs text-muted-foreground">{respostaAtual.evidencias.length} evidência(s) anexada(s)</p>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {navegacao}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}
