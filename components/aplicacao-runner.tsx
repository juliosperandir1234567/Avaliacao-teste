"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Camera, Check, ChevronDown, ChevronUp, Lock, PenLine, ShieldAlert } from "lucide-react";
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
  preencherChecklistSim,
  salvarAssinatura,
  salvarFotoCnh,
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
import { comprimirImagem } from "@/lib/comprimir-imagem";
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

interface Grupo {
  secao: AvaliacaoSecao | undefined;
  secaoId: string;
  perguntas: AvaliacaoPergunta[];
  passos: Passo[];
  temChecklist: boolean;
  temTeorica: boolean;
}

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
  minhaAssinaturaPath = null,
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
  /** Assinatura salva de quem está logado (Minha assinatura) -- habilita "Usar minha assinatura". */
  minhaAssinaturaPath?: string | null;
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

  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [mostrarInterromper, setMostrarInterromper] = useState(false);
  const [motivoInterrupcao, setMotivoInterrupcao] = useState("");
  const [assinaturaAvaliadoPath, setAssinaturaAvaliadoPath] = useState<string | null>(
    assinaturaAvaliadoPathInicial
  );
  const [assinaturaAvaliadorPath, setAssinaturaAvaliadorPath] = useState<string | null>(
    assinaturaAvaliadorPathInicial
  );
  const [observacaoFinal] = useState(observacaoFinalInicial ?? "");
  const [parecerEscolhido, setParecerEscolhido] = useState<Parecer | null>(null);
  const [enviandoAssinatura, setEnviandoAssinatura] = useState(false);
  // Resultado (nota/parecer/análise) só aparece depois que o avaliador libera (etapa 2).
  const [liberadoAvaliador, setLiberadoAvaliador] = useState(false);
  const [fotoCnhPath, setFotoCnhPath] = useState<string | null>(fotoCnhPathInicial);
  const [enviandoFotoCnh, setEnviandoFotoCnh] = useState(false);
  // URL assinada da foto da CNH já anexada -- mostra a miniatura em vez de só "Foto anexada".
  const [fotoCnhUrl, setFotoCnhUrl] = useState<string | null>(null);
  const saveTimer = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    if (!fotoCnhPath) return;
    let cancelado = false;
    createClient()
      .storage.from("evidencias")
      .createSignedUrl(fotoCnhPath, 60 * 60)
      .then(({ data }) => {
        if (!cancelado) setFotoCnhUrl(data?.signedUrl ?? null);
      });
    return () => {
      cancelado = true;
    };
  }, [fotoCnhPath]);

  async function handleFotoCnh(original: File) {
    setEnviandoFotoCnh(true);
    const file = await comprimirImagem(original);
    const supabase = createClient();
    const path = `${aplicacaoId}/cnh-${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file);
    setEnviandoFotoCnh(false);
    if (error) {
      toast.error("Falha ao enviar foto da CNH: " + error.message);
      return;
    }
    setFotoCnhPath(path);
    const salvo = await salvarFotoCnh(aplicacaoId, path);
    if (salvo.error) toast.error("Falha ao gravar foto da CNH: " + salvo.error);
    else toast.success("Foto da CNH anexada");
  }

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

    // Grava na aplicação imediatamente (não só no estado local) pra sobreviver se o avaliador
    // sair da tela de resumo antes de finalizar.
    const salvo = await salvarAssinatura(aplicacaoId, quem, path);
    if (salvo.error) toast.error("Falha ao gravar assinatura: " + salvo.error);
  }

  // Copia a assinatura salva do usuário pra pasta da aplicação (em vez de apontar pro arquivo
  // dele) -- se ele trocar a assinatura depois, esta prova continua com a que foi usada aqui.
  async function usarMinhaAssinatura() {
    if (!minhaAssinaturaPath) return;
    setEnviandoAssinatura(true);
    const supabase = createClient();
    const path = `${aplicacaoId}/avaliador-${Date.now()}.png`;
    const { error } = await supabase.storage.from("assinaturas").copy(minhaAssinaturaPath, path);
    setEnviandoAssinatura(false);
    if (error) {
      toast.error("Falha ao usar a assinatura salva: " + error.message);
      return;
    }
    setAssinaturaAvaliadorPath(path);
    const salvo = await salvarAssinatura(aplicacaoId, "avaliador", path);
    if (salvo.error) toast.error("Falha ao gravar assinatura: " + salvo.error);
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

  // Etapas por seção: cada seção é um bloco que abre/fecha (sanfona). Dentro dela, itens de
  // checklist seguidos viram uma tabela e as demais perguntas aparecem todas na mesma tela.
  const grupos = useMemo<Grupo[]>(() => {
    const porSecao = new Map<string, AvaliacaoPergunta[]>();
    for (const p of perguntasVisiveis) {
      const lista = porSecao.get(p.secao_id) ?? [];
      lista.push(p);
      porSecao.set(p.secao_id, lista);
    }
    return [...porSecao.entries()].map(([secaoId, lista]) => ({
      secao: secaoPorId.get(secaoId),
      secaoId,
      perguntas: lista,
      passos: agruparPassos(lista),
      temChecklist: lista.some((p) => p.tipo === "checklist"),
      temTeorica: lista.some((p) => p.tipo !== "checklist"),
    }));
  }, [perguntasVisiveis, secaoPorId]);

  const grupoCompleto = (g: Grupo) => g.perguntas.every((p) => respostas[p.id]);

  // Trava do avaliado no meio da prova: quando a prova tem seções teóricas (respondidas pelo
  // avaliado) seguidas de checklist (preenchido pelo avaliador), o avaliado clica em "Liberar para
  // o avaliador" antes da primeira seção de checklist (sem assinatura -- a assinatura do avaliado
  // continua só no fechamento). Depois de liberado, dá pra voltar nas seções teóricas normalmente.
  // Ao retomar a prova, já ter resposta de checklist marca a trava como passada.
  const indiceTrava = useMemo(() => {
    const primeiraTeorica = grupos.findIndex((g) => g.temTeorica);
    if (primeiraTeorica === -1) return -1;
    return grupos.findIndex((g, i) => i > primeiraTeorica && g.temChecklist);
  }, [grupos]);
  const temTrava = indiceTrava > 0;
  const [liberadoTrava, setLiberadoTrava] = useState(() =>
    grupos
      .slice(Math.max(indiceTrava, 0))
      .some(
        (g) => indiceTrava > 0 && g.perguntas.some((p) => p.tipo === "checklist" && respostas[p.id])
      )
  );
  const travada = (i: number) => temTrava && !liberadoTrava && i >= indiceTrava;

  // Retomando uma prova em andamento: abre a primeira seção com item sem resposta; se já está
  // tudo respondido, vai direto pro resumo (fechamento).
  const [aberta, setAberta] = useState<number | null>(() => {
    const i = grupos.findIndex((g) => !grupoCompleto(g));
    if (i === -1) return null;
    return temTrava && !liberadoTrava && i >= indiceTrava ? null : i;
  });
  const [mostrarResumo, setMostrarResumo] = useState(
    () => respostasIniciais.length > 0 && perguntasVisiveis.length > 0 && perguntasVisiveis.every((p) => respostas[p.id])
  );
  const secaoRefs = useRef<Record<number, HTMLDivElement | null>>({});
  // Ao abrir uma seção, rola até o topo dela (a de cima acabou de fechar e o conteúdo "pula").
  const primeiraRenderizacao = useRef(true);
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }
    if (aberta === null) return;
    secaoRefs.current[aberta]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [aberta]);

  const totalItens = perguntasVisiveis.length;
  const respondidas = perguntasVisiveis.filter((p) => respostas[p.id]).length;
  const progresso = totalItens > 0 ? Math.round((respondidas / totalItens) * 100) : 0;
  const grupoAberto = aberta !== null ? grupos[aberta] : undefined;

  function concluirSecao(i: number) {
    // Próxima seção pendente depois desta (ou, se não houver, a primeira pendente antes dela).
    const proxima =
      grupos.findIndex((g, j) => j > i && !grupoCompleto(g)) !== -1
        ? grupos.findIndex((g, j) => j > i && !grupoCompleto(g))
        : grupos.findIndex((g, j) => j !== i && !grupoCompleto(g));
    setAberta(proxima === -1 || travada(proxima) ? null : proxima);
  }

  const respostasComoResposta: Resposta[] = useMemo(
    () =>
      perguntasVisiveis
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
        })),
    [perguntasVisiveis, respostas, aplicacaoId]
  );
  // Mesma conta da "Nota preliminar" do fechamento, só que sobre o que já foi respondido.
  const notaParcial = useMemo(
    () => calcularNotaGeral(secoes, perguntasVisiveis, respostasComoResposta),
    [secoes, perguntasVisiveis, respostasComoResposta]
  );

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

  async function handleEvidencia(perguntaId: string, original: File) {
    const file = await comprimirImagem(original);
    const supabase = createClient();
    const path = `${aplicacaoId}/${perguntaId}/${carimboTempo()}-${file.name}`;
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

  // Checklist já abre com "Sim" marcado nos itens sem resposta -- o avaliador só troca os que
  // estão "Não"/N.A. Só roda quando a tabela realmente aparece (depois da trava do avaliado) e
  // cada item é pré-preenchido uma vez só (ref), pra não brigar com o que o avaliador desmarcar.
  const checklistPreenchido = useRef<Set<string>>(new Set());
  const exibindoChecklist =
    Boolean(grupoAberto?.temChecklist) && aberta !== null && !travada(aberta) && !mostrarResumo;
  useEffect(() => {
    if (!exibindoChecklist || !grupoAberto) return;
    const pendentes = grupoAberto.perguntas.filter(
      (p) => p.tipo === "checklist" && !respostas[p.id] && !checklistPreenchido.current.has(p.id)
    );
    if (pendentes.length === 0) return;
    pendentes.forEach((p) => checklistPreenchido.current.add(p.id));
    setRespostas((prev) => {
      const novo = { ...prev };
      for (const p of pendentes) {
        if (novo[p.id]) continue;
        novo[p.id] = { valor: { status: "sim" }, observacao: "", pontuacaoManual: null, evidencias: [], pontuacao: null };
      }
      return novo;
    });
    setSaveStatus("saving");
    preencherChecklistSim(
      aplicacaoId,
      pendentes.map((p) => p.id)
    ).then((result) => {
      if ("error" in result && result.error) {
        toast.error(result.error);
        setSaveStatus("idle");
        return;
      }
      const pontuacoes = result.pontuacoes ?? {};
      setRespostas((prev) => {
        const novo = { ...prev };
        for (const [id, pontuacao] of Object.entries(pontuacoes)) {
          const atual = novo[id];
          // Se o avaliador já trocou o item enquanto salvava, não mexe.
          if (atual && "status" in atual.valor && atual.valor.status === "sim" && atual.pontuacao === null) {
            novo[id] = { ...atual, pontuacao };
          }
        }
        return novo;
      });
      setSaveStatus("saved");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exibindoChecklist, aberta]);

  if (grupos.length === 0) {
    return <p className="text-center text-muted-foreground">Esta avaliação não possui perguntas.</p>;
  }

  if (mostrarResumo) {
    const notaPreliminar = notaParcial;
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
        <div className="flex w-full flex-col gap-4">
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
      <div className="flex w-full flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Resumo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            {/* Contagens e nota saíram daqui: a nota fica em destaque no card da análise, ao lado
                do Aprovado/Reprovado. */}
            {naoAvaliados > 0 ? (
              <p className="text-xs text-destructive">
                Ainda há {naoAvaliados} item(ns) sem resposta. Volte e responda todos antes de finalizar.
              </p>
            ) : null}

            <div className="flex flex-col gap-1.5">
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

            {/* "Considerações do avaliador" saiu: quando precisar, o avaliador edita o texto do
                parecer na análise. O que já tinha sido digitado continua sendo enviado ao finalizar. */}

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
            {minhaAssinaturaPath && !assinaturaAvaliadorPath ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-fit"
                disabled={enviandoAssinatura}
                onClick={usarMinhaAssinatura}
              >
                <PenLine className="size-4" /> Usar minha assinatura
              </Button>
            ) : null}
            <SignaturePad
              label="Assinatura do avaliador"
              captured={Boolean(assinaturaAvaliadorPath)}
              onCapture={(blob) => capturarAssinatura("avaliador", blob)}
            />

            <div className="flex justify-between gap-2 pt-2">
              <Button variant="outline" onClick={() => setMostrarResumo(false)}>
                Revisar
              </Button>
              <Button
                disabled={
                  pending ||
                  enviandoAssinatura ||
                  !assinaturaAvaliadoPath ||
                  !assinaturaAvaliadorPath ||
                  naoAvaliados > 0
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
            {grupos.filter(grupoCompleto).length} de {grupos.length} seções — {respondidas}/{totalItens} itens (
            {progresso}%)
            {/* Nota parcial só com uma seção do avaliador (checklist) aberta -- nas teóricas quem
                está com o aparelho é o avaliado, então ela não aparece. */}
            {exibindoChecklist && notaParcial !== null ? (
              <span className="font-medium text-foreground"> — nota parcial: {notaParcial.toFixed(1)}</span>
            ) : null}
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

      <div className="flex flex-col gap-1.5 rounded-md border border-amber-300 bg-amber-50 p-2.5">
        <Label htmlFor="fotoCnh" className="flex items-center gap-1 text-xs text-amber-800">
          <Camera className="size-3.5" /> Foto da CNH do candidato
          {fotoCnhPath ? <span className="font-normal">(enviar outra substitui a atual)</span> : null}
        </Label>
        {fotoCnhPath ? (
          fotoCnhUrl ? (
            <a href={fotoCnhUrl} target="_blank" rel="noreferrer" title="Abrir foto em tamanho real">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={fotoCnhUrl}
                alt="Foto da CNH anexada"
                className="max-h-48 w-auto rounded border bg-background object-contain"
              />
            </a>
          ) : (
            <p className="text-xs text-amber-800">Carregando foto anexada...</p>
          )
        ) : null}
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

  function renderPergunta(pergunta: AvaliacaoPergunta, numero: number) {
    const respostaAtual = respostas[pergunta.id];
    const precisaManual = precisaCorrecaoManual(pergunta);
    return (
      <Card key={pergunta.id} size="sm">
        <CardHeader className="pb-2">
          <Badge variant="outline" className="w-fit text-xs">
            {PERGUNTA_TIPO_LABELS[pergunta.tipo]}
          </Badge>
          <CardTitle className="text-base font-medium">
            {numero}) {pergunta.enunciado}
          </CardTitle>
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
        </CardContent>
      </Card>
    );
  }

  function renderConteudoSecao(g: Grupo) {
    let numero = 0;
    return g.passos.map((passo) => {
      if (passo.tipo === "checklist") {
        const respostaPorPergunta = new Map(
          passo.perguntas.map((p) => [
            p.id,
            respostas[p.id]
              ? { valor: respostas[p.id].valor, observacao: respostas[p.id].observacao, evidencias: respostas[p.id].evidencias }
              : undefined,
          ])
        );
        return (
          <ChecklistTable
            key={`cl-${passo.perguntas[0].id}`}
            perguntas={passo.perguntas}
            escala={g.secao?.escala_checklist ?? "sim_nao"}
            respostaPorPergunta={respostaPorPergunta}
            onSetStatus={setChecklistStatus}
            onSetObservacao={setChecklistObservacao}
            onUploadEvidencia={handleEvidencia}
          />
        );
      }
      numero += 1;
      return renderPergunta(passo.pergunta, numero);
    });
  }

  const tudoRespondido = totalItens > 0 && respondidas === totalItens;
  const pendentesAntesDaTrava = temTrava
    ? grupos.slice(0, indiceTrava).reduce((n, g) => n + g.perguntas.filter((p) => !respostas[p.id]).length, 0)
    : 0;

  return (
    <div className="flex w-full flex-col gap-3">
      {cabecalho}

      <div className="flex flex-col gap-2">
        {grupos.map((g, i) => {
          const completo = grupoCompleto(g);
          const bloqueada = travada(i);
          const isAberta = aberta === i;
          const feitos = g.perguntas.filter((p) => respostas[p.id]).length;
          const pendentes = g.perguntas.length - feitos;

          return (
            <div
              key={g.secaoId}
              ref={(el) => {
                secaoRefs.current[i] = el;
              }}
              className="scroll-mt-16"
            >
              {/* Trava: aparece antes da primeira seção do avaliador enquanto não for liberada. */}
              {i === indiceTrava && temTrava && !liberadoTrava ? (
                <Card className="mb-2 border-primary">
                  <CardContent className="flex flex-col gap-2 pt-4 text-sm">
                    {pendentesAntesDaTrava > 0 ? (
                      <p className="text-xs text-destructive">
                        Ainda há {pendentesAntesDaTrava} pergunta(s) sem resposta nas seções acima. Responda antes de
                        liberar.
                      </p>
                    ) : (
                      <p className="text-muted-foreground">
                        Perguntas respondidas. Entregue o aparelho ao avaliador e clique em liberar.
                      </p>
                    )}
                    <Button
                      className="w-fit"
                      disabled={pendentesAntesDaTrava > 0}
                      onClick={() => {
                        setLiberadoTrava(true);
                        const proxima = grupos.findIndex((x, j) => j >= indiceTrava && !grupoCompleto(x));
                        setAberta(proxima === -1 ? null : proxima);
                      }}
                    >
                      Liberar para o avaliador
                    </Button>
                  </CardContent>
                </Card>
              ) : null}

              <div className={`rounded-lg border ${isAberta ? "border-primary/60 shadow-sm" : ""}`}>
                <button
                  type="button"
                  disabled={bloqueada}
                  onClick={() => setAberta(isAberta ? null : i)}
                  className={`flex w-full items-center gap-3 px-3 py-3 text-left ${
                    bloqueada ? "cursor-not-allowed opacity-60" : "hover:bg-muted/50"
                  } ${isAberta ? "bg-primary/5" : ""}`}
                >
                  <span
                    className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                      completo ? "bg-green-600 text-white" : isAberta ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}
                  >
                    {completo ? <Check className="size-4" /> : i + 1}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate font-medium">{g.secao?.nome ?? `Seção ${i + 1}`}</span>
                    <span className="text-xs text-muted-foreground">
                      {g.temChecklist && !g.temTeorica ? "Checklist do avaliador" : g.temTeorica && !g.temChecklist ? "Perguntas" : "Perguntas e checklist"}{" "}
                      · {feitos}/{g.perguntas.length}
                    </span>
                  </span>
                  {bloqueada ? (
                    <Lock className="size-4 shrink-0 text-muted-foreground" />
                  ) : completo && !isAberta ? (
                    <span className="shrink-0 text-xs text-primary">revisar</span>
                  ) : isAberta ? (
                    <ChevronUp className="size-4 shrink-0" />
                  ) : (
                    <ChevronDown className="size-4 shrink-0" />
                  )}
                </button>

                {isAberta ? (
                  <div className="flex flex-col gap-3 border-t p-3">
                    {renderConteudoSecao(g)}
                    <div className="flex flex-col items-end gap-1.5">
                      {pendentes > 0 ? (
                        <p className="text-xs text-destructive">
                          Responda todos os itens desta seção ({pendentes} pendente{pendentes > 1 ? "s" : ""}) para
                          concluir.
                        </p>
                      ) : null}
                      <Button disabled={pendentes > 0} onClick={() => concluirSecao(i)}>
                        Concluir seção →
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col items-end gap-1.5 pb-4 pt-2">
        {!tudoRespondido ? (
          <p className="text-xs text-muted-foreground">
            Conclua todas as seções para revisar e finalizar ({totalItens - respondidas} item(ns) pendente(s)).
          </p>
        ) : null}
        <Button size="lg" disabled={!tudoRespondido} onClick={() => setMostrarResumo(true)}>
          Revisar e Finalizar
        </Button>
      </div>
    </div>
  );
}


/** Timestamp pro nome do arquivo de evidência (fora do componente: o lint do React Compiler
 * reclama de Date.now() em função alcançável a partir do render, mesmo só rodando em evento). */
function carimboTempo() {
  return Date.now();
}
