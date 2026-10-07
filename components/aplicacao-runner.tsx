"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, CloudOff, ShieldAlert } from "lucide-react";
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
import { AnaliseCard } from "@/components/analise-card";
import { gerarAnaliseAvaliacao } from "@/lib/analise";
import { ChecklistTable } from "@/components/checklist-table";
import { createClient } from "@/utils/supabase/client";
import {
  finalizarAplicacao,
  interromperPorSeguranca,
  salvarAssinatura,
  salvarFotoCnh,
  salvarObservacaoFinal,
  salvarResposta,
} from "@/app/(app)/aplicacoes/actions";
import {
  avaliarItensCriticos,
  calcularNotaGeral,
  calcularPontuacaoResposta,
  calcularNotasPorCompetencia,
  gerarParecerSugerido,
  precisaCorrecaoManual,
} from "@/lib/scoring";
import { condicaoAtendida } from "@/lib/conditional";
import { ehErroDeRede, enfileirar, idResposta, listarFila, removerSeIgual, type AcaoAposUpload, type ItemFila } from "@/lib/fila-offline";
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
  assinaturaAvaliadoPathInicial = null,
  assinaturaAvaliadorPathInicial = null,
  observacaoFinalInicial = null,
  fotoCnhPathInicial = null,
  tipoPessoa = null,
  funcaoAvaliada = null,
  parecerTextoInicial = null,
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
  assinaturaAvaliadoPathInicial?: string | null;
  assinaturaAvaliadorPathInicial?: string | null;
  observacaoFinalInicial?: string | null;
  fotoCnhPathInicial?: string | null;
  tipoPessoa?: "interno" | "externo" | null;
  funcaoAvaliada?: string | null;
  parecerTextoInicial?: string | null;
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

  // Fila offline: quantos itens ainda não chegaram no servidor e se o aparelho está com sinal.
  const [pendentes, setPendentes] = useState(0);
  const [online, setOnline] = useState(true);
  const [sincronizando, setSincronizando] = useState(false);
  const [jaSalvou, setJaSalvou] = useState(false);
  const [mostrarInterromper, setMostrarInterromper] = useState(false);
  const [motivoInterrupcao, setMotivoInterrupcao] = useState("");
  const [assinaturaAvaliadoPath, setAssinaturaAvaliadoPath] = useState<string | null>(
    assinaturaAvaliadoPathInicial
  );
  const [assinaturaAvaliadorPath, setAssinaturaAvaliadorPath] = useState<string | null>(
    assinaturaAvaliadorPathInicial
  );
  const [observacaoFinal, setObservacaoFinal] = useState(observacaoFinalInicial ?? "");
  const [parecerEscolhido, setParecerEscolhido] = useState<Parecer | null>(null);
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false);
  // Resultado (nota/parecer/análise) só aparece depois que o avaliador libera (etapa 2).
  const [liberadoAvaliador, setLiberadoAvaliador] = useState(false);
  const [fotoCnhPath, setFotoCnhPath] = useState<string | null>(fotoCnhPathInicial);
  const [enviandoFotoCnh, setEnviandoFotoCnh] = useState(false);
  const observacaoFinalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---------------------------------------------------------------------------------------
  // Fila offline: tudo é gravado no aparelho primeiro e enviado em seguida; sem sinal, fica na
  // fila e é reenviado sozinho quando a conexão volta (lib/fila-offline.ts).
  // ---------------------------------------------------------------------------------------
  const sincronizandoRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Envia um item. "rede" = sem sinal (fica na fila); "rejeitado" = servidor recusou (sai da fila). */
  async function enviarItem(item: ItemFila): Promise<"ok" | "rede" | "rejeitado"> {
    try {
      if (item.tipo === "resposta") {
        const result = await salvarResposta(item.payload);
        if (result.error) {
          toast.error(result.error);
          return "rejeitado";
        }
        // Só aplica a pontuação oficial se a resposta não mudou de novo enquanto ia pro servidor.
        if (ultimaVersao.current[item.perguntaId] === item.criadoEm) {
          setRespostas((prev) =>
            prev[item.perguntaId] ? { ...prev, [item.perguntaId]: { ...prev[item.perguntaId], pontuacao: result.pontuacao ?? null } } : prev
          );
        }
        return "ok";
      }
      if (item.tipo === "observacaoFinal") {
        const result = await salvarObservacaoFinal(aplicacaoId, item.texto);
        if (result?.error) {
          toast.error(result.error);
          return "rejeitado";
        }
        return "ok";
      }
      const supabase = createClient();
      const { error } = await supabase.storage
        .from(item.bucket)
        .upload(item.path, item.blob, { contentType: item.contentType, upsert: true });
      if (error) {
        if (ehErroDeRede(error)) return "rede";
        toast.error("Falha ao enviar arquivo: " + error.message);
        return "rejeitado";
      }
      if (item.depois?.tipo === "assinatura") {
        const salvo = await salvarAssinatura(aplicacaoId, item.depois.quem, item.path);
        if (salvo.error) toast.error("Falha ao gravar assinatura: " + salvo.error);
      } else if (item.depois?.tipo === "cnh") {
        const salvo = await salvarFotoCnh(aplicacaoId, item.path);
        if (salvo.error) toast.error("Falha ao gravar foto da CNH: " + salvo.error);
      }
      return "ok";
    } catch (erro) {
      // Server action sem sinal lança exceção (fetch falhou) — fica na fila pra tentar de novo.
      if (ehErroDeRede(erro)) return "rede";
      toast.error("Falha ao salvar: " + (erro instanceof Error ? erro.message : String(erro)));
      return "rede";
    }
  }

  const sincronizar = useCallback(async () => {
    if (sincronizandoRef.current) return;
    sincronizandoRef.current = true;
    setSincronizando(true);
    try {
      const itens = await listarFila(aplicacaoId);
      for (const item of itens) {
        const resultado = await enviarItem(item);
        if (resultado === "rede") break;
        await removerSeIgual(item.id, item.criadoEm);
        setJaSalvou(true);
      }
    } finally {
      setPendentes((await listarFila(aplicacaoId)).length);
      sincronizandoRef.current = false;
      setSincronizando(false);
    }
    // enviarItem usa só refs/setters estáveis e props da aplicação.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aplicacaoId]);

  /** Grava no aparelho e agenda o envio (com atraso curto pra juntar digitação). */
  async function guardarEEnviar(item: ItemFila, atrasoMs = 0) {
    await enfileirar(item);
    setPendentes((await listarFila(aplicacaoId)).length);
    if (syncTimer.current) clearTimeout(syncTimer.current);
    syncTimer.current = setTimeout(() => void sincronizar(), atrasoMs);
  }

  async function guardarArquivo(
    bucket: "evidencias" | "assinaturas",
    path: string,
    blob: Blob,
    depois: AcaoAposUpload,
    contentType?: string
  ) {
    await guardarEEnviar({
      id: `upload:${path}`,
      aplicacaoId,
      tipo: "upload",
      bucket,
      path,
      blob,
      contentType: contentType ?? (blob.type || undefined),
      depois,
      criadoEm: Date.now(),
    });
  }

  async function handleFotoCnh(file: File) {
    setEnviandoFotoCnh(true);
    const path = `${aplicacaoId}/cnh-${Date.now()}-${file.name}`;
    await guardarArquivo("evidencias", path, file, { tipo: "cnh" });
    setFotoCnhPath(path);
    setEnviandoFotoCnh(false);
    toast.success(navigator.onLine ? "Foto da CNH anexada" : "Foto da CNH guardada; será enviada quando houver sinal");
  }

  function handleObservacaoFinalChange(texto: string) {
    setObservacaoFinal(texto);
    if (observacaoFinalTimer.current) clearTimeout(observacaoFinalTimer.current);
    observacaoFinalTimer.current = setTimeout(() => {
      void guardarEEnviar({ id: `obs:${aplicacaoId}`, aplicacaoId, tipo: "observacaoFinal", texto, criadoEm: Date.now() });
    }, 500);
  }

  async function capturarAssinatura(quem: "avaliado" | "avaliador", blob: Blob) {
    setEnviandoAssinatura(true);
    const path = `${aplicacaoId}/${quem}-${Date.now()}.png`;
    // Guardada no aparelho e gravada na aplicação assim que subir (salvarAssinatura) — sobrevive
    // se o avaliador sair da tela de resumo antes de finalizar, e se o sinal cair.
    await guardarArquivo("assinaturas", path, blob, { tipo: "assinatura", quem }, "image/png");
    if (quem === "avaliado") setAssinaturaAvaliadoPath(path);
    else setAssinaturaAvaliadorPath(path);
    setEnviandoAssinatura(false);
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

  // Retomando uma prova em andamento: abre no primeiro passo com item sem resposta; se já está
  // tudo respondido, vai direto pro resumo (fechamento) em vez de recomeçar do passo 1.
  const [index, setIndex] = useState(() => {
    const i = passos.findIndex((passo) =>
      (passo.tipo === "checklist" ? passo.perguntas : [passo.pergunta]).some((p) => !respostas[p.id])
    );
    return i === -1 ? Math.max(0, passos.length - 1) : i;
  });
  const [mostrarResumo, setMostrarResumo] = useState(
    () => respostasIniciais.length > 0 && perguntasVisiveis.length > 0 && perguntasVisiveis.every((p) => respostas[p.id])
  );

  const totalItens = perguntasVisiveis.length;
  const respondidas = perguntasVisiveis.filter((p) => respostas[p.id]).length;
  const totalPassos = passos.length;
  const indiceSeguro = Math.min(index, Math.max(0, totalPassos - 1));
  const passoAtual = passos[indiceSeguro];
  const progresso = totalPassos > 0 ? Math.round(((indiceSeguro + 1) / totalPassos) * 100) : 0;

  /** Versão (criadoEm) mais recente de cada resposta — evita que um envio atrasado sobrescreva
   * a pontuação de uma resposta que já foi trocada. */
  const ultimaVersao = useRef<Record<string, number>>({});

  function persistir(perguntaId: string, novaResposta: RespostaLocal, imediato = false) {
    // Pontuação provisória calculada no próprio aparelho (mesma regra do servidor), pra nota e
    // resumo funcionarem sem sinal; a oficial chega quando o envio for confirmado.
    const pergunta = perguntasPorId.get(perguntaId);
    const alternativasCorretas = new Set(
      (alternativasPorPergunta.get(perguntaId) ?? []).filter((a) => a.correta).map((a) => a.id)
    );
    const pontuacao =
      pergunta && novaResposta.valor
        ? calcularPontuacaoResposta(pergunta, novaResposta.valor, alternativasCorretas, novaResposta.pontuacaoManual)
        : null;
    setRespostas((prev) => ({ ...prev, [perguntaId]: { ...novaResposta, pontuacao } }));

    const criadoEm = Date.now();
    ultimaVersao.current[perguntaId] = criadoEm;
    void guardarEEnviar(
      {
        id: idResposta(aplicacaoId, perguntaId),
        aplicacaoId,
        tipo: "resposta",
        perguntaId,
        payload: {
          aplicacaoId,
          perguntaId,
          valor: novaResposta.valor,
          observacao: novaResposta.observacao,
          pontuacaoManual: novaResposta.pontuacaoManual,
          evidencias: novaResposta.evidencias,
        },
        criadoEm,
      },
      imediato ? 0 : 500
    );
  }

  // Ao abrir: recupera do aparelho o que ainda não tinha subido (ex.: sinal caiu e a página foi
  // recarregada depois) e tenta enviar. Também reenvia quando a conexão volta e, enquanto houver
  // pendência, a cada 20s.
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const itens = await listarFila(aplicacaoId);
      if (!ativo) return;
      const respostasLocais = itens.filter((i): i is Extract<ItemFila, { tipo: "resposta" }> => i.tipo === "resposta");
      if (respostasLocais.length > 0) {
        setRespostas((prev) => {
          const novo = { ...prev };
          for (const i of respostasLocais) {
            ultimaVersao.current[i.perguntaId] = i.criadoEm;
            novo[i.perguntaId] = {
              valor: i.payload.valor,
              observacao: i.payload.observacao ?? "",
              pontuacaoManual: i.payload.pontuacaoManual ?? null,
              evidencias: i.payload.evidencias ?? [],
              pontuacao: prev[i.perguntaId]?.pontuacao ?? null,
            };
          }
          return novo;
        });
      }
      for (const i of itens) {
        if (i.tipo === "upload" && i.depois?.tipo === "assinatura") {
          if (i.depois.quem === "avaliado") setAssinaturaAvaliadoPath(i.path);
          else setAssinaturaAvaliadorPath(i.path);
        }
        if (i.tipo === "upload" && i.depois?.tipo === "cnh") setFotoCnhPath(i.path);
        if (i.tipo === "observacaoFinal") setObservacaoFinal(i.texto);
      }
      setPendentes(itens.length);
      void sincronizar();
    })();

    const aoConectar = () => {
      setOnline(true);
      void sincronizar();
    };
    const aoDesconectar = () => setOnline(false);
    window.addEventListener("online", aoConectar);
    window.addEventListener("offline", aoDesconectar);
    return () => {
      ativo = false;
      window.removeEventListener("online", aoConectar);
      window.removeEventListener("offline", aoDesconectar);
    };
  }, [aplicacaoId, sincronizar]);

  useEffect(() => {
    if (pendentes === 0) return;
    const t = setInterval(() => void sincronizar(), 20000);
    return () => clearInterval(t);
  }, [pendentes, sincronizar]);

  async function handleEvidencia(perguntaId: string, file: File) {
    const path = `${aplicacaoId}/${perguntaId}/${Date.now()}-${file.name}`;
    await guardarArquivo("evidencias", path, file, null);
    const atual = respostas[perguntaId];
    const base: RespostaLocal = atual ?? {
      valor: { texto: "" } as RespostaValor,
      observacao: "",
      pontuacaoManual: null,
      evidencias: [],
      pontuacao: null,
    };
    persistir(perguntaId, { ...base, evidencias: [...base.evidencias, path] }, true);
    toast.success(navigator.onLine ? "Evidência anexada" : "Evidência guardada; será enviada quando houver sinal");
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

    // Etapa 1: o avaliado só vê o próprio nome e assina. Nota, parecer e análise ficam escondidos
    // até o avaliador clicar em "Liberar para o avaliador" (etapa 2).
    if (!liberadoAvaliador) {
      return (
        <div className="mx-auto flex max-w-xl flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{pessoaNome}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3 text-sm">
              {naoAvaliados > 0 ? (
                <p className="text-xs text-destructive">
                  Ainda há {naoAvaliados} item(ns) sem resposta. Revise antes da assinatura.
                </p>
              ) : (
                <SignaturePad
                  label="Assinatura do avaliado"
                  captured={Boolean(assinaturaAvaliadoPath)}
                  onCapture={(blob) => capturarAssinatura("avaliado", blob)}
                />
              )}
              <div className="flex justify-between gap-2 pt-2">
                <Button variant="outline" onClick={() => setMostrarResumo(false)}>
                  Revisar
                </Button>
                <Button
                  disabled={enviandoAssinatura || !assinaturaAvaliadoPath || naoAvaliados > 0}
                  onClick={() => setLiberadoAvaliador(true)}
                >
                  Liberar para o avaliador
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="mx-auto flex max-w-xl flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Row label="Itens" value={String(totalItens)} />
            <Row label="Respondidos" value={String(respondidas)} />
            <Row label="Não avaliados" value={String(naoAvaliados)} highlight={naoAvaliados > 0} />
            <Row label="Falhas críticas" value={String(falhasCriticas.length)} highlight={falhasCriticas.length > 0} />
            <Row label="Nota preliminar" value={notaPreliminar !== null ? notaPreliminar.toFixed(1) : "-"} />
            {naoAvaliados > 0 ? (
              <p className="-mt-1.5 text-xs text-destructive">
                Volte e responda todos os itens antes de finalizar.
              </p>
            ) : null}

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
                onChange={(e) => handleObservacaoFinalChange(e.target.value)}
                placeholder="Justificativa/observações para o parecer final"
              />
            </div>

            <p className="border-t pt-3 text-xs text-green-700">✔ Assinatura do avaliado coletada</p>
          </CardContent>
        </Card>

        {/* Etapa 2 (liberada pelo avaliador): confere a análise e o PDF e, estando tudo certo,
            assina e finaliza. */}
        <AnaliseCard
          analise={gerarAnaliseAvaliacao(secoes, perguntasVisiveis, respostasComoResposta, parecerFinal, {
            tipoPessoa,
            funcao: funcaoAvaliada,
          })}
          edicao={{ aplicacaoId, textoSalvo: parecerTextoInicial }}
        />
        <Button
          variant="outline"
          render={
            <a
              href={`/aplicacoes/${aplicacaoId}/relatorio${parecerFinal ? `?parecer=${parecerFinal}` : ""}`}
              target="_blank"
              rel="noreferrer"
            >
              Ver prévia do relatório (PDF)
            </a>
          }
        />

        <Card>
          <CardContent className="flex flex-col gap-3 pt-4 text-sm">
            <SignaturePad
              label="Assinatura do avaliador"
              captured={Boolean(assinaturaAvaliadorPath)}
              onCapture={(blob) => capturarAssinatura("avaliador", blob)}
            />

            <div className="flex flex-wrap justify-between gap-2 pt-2">
              {!online || pendentes > 0 ? (
                <p className="w-full text-xs text-amber-700">
                  {!online
                    ? "Sem conexão. Para finalizar, é preciso estar com sinal (as respostas estão guardadas no aparelho)."
                    : `Enviando ${pendentes} item(ns) guardado(s) no aparelho... aguarde para finalizar.`}
                </p>
              ) : null}
              <Button variant="outline" onClick={() => setMostrarResumo(false)}>
                Revisar
              </Button>
              <Button
                disabled={
                  pending ||
                  enviandoAssinatura ||
                  !assinaturaAvaliadoPath ||
                  !assinaturaAvaliadorPath ||
                  naoAvaliados > 0 ||
                  !online ||
                  pendentes > 0
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
                    if (result && "precisaAprovacao" in result && result.precisaAprovacao) {
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
          <IndicadorEnvio online={online} pendentes={pendentes} sincronizando={sincronizando} jaSalvou={jaSalvou} />
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

      <div className="flex flex-col gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2.5">
        <Label htmlFor="fotoCnh" className="flex items-center gap-1 text-xs text-amber-800">
          <Camera className="size-3.5" /> Foto da CNH do candidato
        </Label>
        <Input
          id="fotoCnh"
          type="file"
          accept="image/*"
          className="h-10 bg-background"
          disabled={enviandoFotoCnh}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFotoCnh(file);
          }}
        />
        {fotoCnhPath ? <p className="text-xs text-amber-800">Foto anexada.</p> : null}
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
                    if (result && "precisaAprovacao" in result && result.precisaAprovacao) {
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

  const itensPendentesNoPasso =
    passoAtual.tipo === "checklist" ? passoAtual.perguntas.filter((p) => !respostas[p.id]).length : 0;
  const passoIncompleto = itensPendentesNoPasso > 0;

  const navegacao = (
    <div className="flex flex-col gap-1.5 pb-4">
      {passoIncompleto ? (
        <p className="text-right text-xs text-destructive">
          Responda todos os itens do checklist ({itensPendentesNoPasso} pendente
          {itensPendentesNoPasso > 1 ? "s" : ""}) para continuar.
        </p>
      ) : null}
      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={indiceSeguro === 0} onClick={() => setIndex(Math.max(0, indiceSeguro - 1))}>
          Anterior
        </Button>
        {indiceSeguro === totalPassos - 1 ? (
          <Button disabled={passoIncompleto} onClick={() => setMostrarResumo(true)}>
            Revisar e Finalizar
          </Button>
        ) : (
          <Button disabled={passoIncompleto} onClick={() => setIndex(Math.min(totalPassos - 1, indiceSeguro + 1))}>
            Próxima
          </Button>
        )}
      </div>
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

/** Situação do envio no topo da prova: salvo, enviando ou sem sinal (com o que está guardado). */
function IndicadorEnvio({
  online,
  pendentes,
  sincronizando,
  jaSalvou,
}: {
  online: boolean;
  pendentes: number;
  sincronizando: boolean;
  jaSalvou: boolean;
}) {
  if (!online) {
    return (
      <span className="flex items-center gap-1 font-medium text-amber-700">
        <CloudOff className="size-3.5" /> Sem sinal{pendentes > 0 ? ` · ${pendentes} guardada(s) no aparelho` : ""}
      </span>
    );
  }
  if (pendentes > 0) {
    return <span className="text-amber-700">{sincronizando ? "Enviando" : "Aguardando envio"} ({pendentes})...</span>;
  }
  return <span>{jaSalvou ? "Salvo" : ""}</span>;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex items-center justify-between border-b pb-2">
      <span className="text-muted-foreground">{label}</span>
      <span className={`font-semibold ${highlight ? "text-destructive" : ""}`}>{value}</span>
    </div>
  );
}
