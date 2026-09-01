"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import {
  avaliarItensCriticos,
  calcularNotaGeral,
  calcularNotasPorCompetencia,
  calcularPontuacaoResposta,
  gerarParecerSugerido,
} from "@/lib/scoring";
import type {
  AvaliacaoAplicada,
  AvaliacaoCompetencia,
  AvaliacaoPergunta,
  AvaliacaoSecao,
  Parecer,
  Resposta,
  RespostaValor,
} from "@/lib/types";

export async function claimPendenciaSeNecessario(aplicacaoId: string) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: aplicacao } = await supabase
    .from("avaliacoes_aplicadas")
    .select("status")
    .eq("id", aplicacaoId)
    .single();

  if (!aplicacao || aplicacao.status !== "pendente") return;

  await supabase
    .from("avaliacoes_aplicadas")
    .update({ avaliador_id: profile.id, status: "em_andamento" })
    .eq("id", aplicacaoId)
    .eq("status", "pendente");
}

export async function getAplicacaoRunnerData(aplicacaoId: string) {
  const supabase = await createClient();

  const { data: aplicacao } = await supabase
    .from("avaliacoes_aplicadas")
    .select(
      "*, avaliacoes(nome, instrucoes_candidato, instrucoes_avaliador, nota_minima, exige_assinatura)"
    )
    .eq("id", aplicacaoId)
    .single();

  if (!aplicacao) return null;

  const { data: secoes } = await supabase
    .from("avaliacao_secoes")
    .select("*")
    .eq("avaliacao_id", aplicacao.avaliacao_id)
    .order("ordem");

  const { data: perguntasRaw } = await supabase
    .from("avaliacao_perguntas")
    .select("*, avaliacao_secoes!inner(avaliacao_id)")
    .eq("avaliacao_secoes.avaliacao_id", aplicacao.avaliacao_id)
    .order("ordem");

  const perguntas = (perguntasRaw ?? []).filter(
    (p) => !p.equipamento_tipo_id || p.equipamento_tipo_id === aplicacao.equipamento_tipo_id
  );

  const perguntaIds = perguntas.map((p) => p.id);
  const { data: alternativas } = perguntaIds.length
    ? await supabase.from("avaliacao_alternativas").select("*").in("pergunta_id", perguntaIds)
    : { data: [] };

  const { data: respostas } = await supabase
    .from("respostas")
    .select("*")
    .eq("aplicacao_id", aplicacaoId);

  const { data: competencias } = await supabase
    .from("avaliacao_competencias")
    .select("*")
    .eq("avaliacao_id", aplicacao.avaliacao_id);

  return {
    aplicacao: aplicacao as AvaliacaoAplicada & {
      avaliacoes: {
        nome: string;
        instrucoes_candidato: string | null;
        instrucoes_avaliador: string | null;
        nota_minima: number;
        exige_assinatura: boolean;
      };
    },
    secoes: (secoes ?? []) as AvaliacaoSecao[],
    perguntas: perguntas as AvaliacaoPergunta[],
    alternativas: alternativas ?? [],
    respostas: (respostas ?? []) as Resposta[],
    competencias: (competencias ?? []) as AvaliacaoCompetencia[],
  };
}

export interface SalvarRespostaInput {
  aplicacaoId: string;
  perguntaId: string;
  valor: RespostaValor;
  observacao?: string;
  pontuacaoManual?: number | null;
  evidencias?: string[];
}

export async function salvarResposta(input: SalvarRespostaInput) {
  const supabase = await createClient();

  const { data: pergunta } = await supabase
    .from("avaliacao_perguntas")
    .select("*")
    .eq("id", input.perguntaId)
    .single();

  if (!pergunta) return { error: "Pergunta não encontrada" };

  let alternativasCorretas: Set<string> | undefined;
  if (pergunta.tipo === "multipla_escolha" || pergunta.tipo === "multiplas_respostas") {
    const { data: alts } = await supabase
      .from("avaliacao_alternativas")
      .select("id, correta")
      .eq("pergunta_id", input.perguntaId);
    alternativasCorretas = new Set((alts ?? []).filter((a) => a.correta).map((a) => a.id));
  }

  const pontuacao = calcularPontuacaoResposta(
    pergunta as AvaliacaoPergunta,
    input.valor,
    alternativasCorretas,
    input.pontuacaoManual ?? null
  );

  const itemCriticoFalhou = Boolean(pergunta.item_critico) && pontuacao === 0;

  const { error } = await supabase.from("respostas").upsert(
    {
      aplicacao_id: input.aplicacaoId,
      pergunta_id: input.perguntaId,
      tipo: pergunta.tipo,
      resposta: input.valor,
      pontuacao,
      observacao: input.observacao || null,
      evidencias: input.evidencias ?? [],
      item_critico_falhou: itemCriticoFalhou,
    },
    { onConflict: "aplicacao_id,pergunta_id" }
  );

  if (error) return { error: error.message };
  return { success: true, pontuacao };
}

export interface AssinaturasInput {
  avaliadoPath?: string;
  avaliadorPath?: string;
}

export async function finalizarAplicacao(
  aplicacaoId: string,
  assinaturas?: AssinaturasInput,
  skipAssinaturaCheck = false
) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const runnerData = await getAplicacaoRunnerData(aplicacaoId);
  if (!runnerData) return { error: "Avaliação não encontrada" };

  const { secoes, perguntas, respostas, competencias, aplicacao } = runnerData;

  if (
    !skipAssinaturaCheck &&
    aplicacao.avaliacoes.exige_assinatura &&
    (!assinaturas?.avaliadoPath || !assinaturas?.avaliadorPath)
  ) {
    return { error: "Esta avaliação exige a assinatura do avaliado e do avaliador antes de finalizar." };
  }

  const notaGeral = calcularNotaGeral(secoes, perguntas, respostas);
  const notasPorCompetencia = calcularNotasPorCompetencia(competencias, perguntas, respostas);
  const falhasCriticas = avaliarItensCriticos(perguntas, respostas);
  const parecerSugerido = gerarParecerSugerido({
    notaGeral,
    notaMinima: aplicacao.avaliacoes.nota_minima,
    competencias,
    notasPorCompetencia,
    falhasCriticas,
  });

  const { error } = await supabase
    .from("avaliacoes_aplicadas")
    .update({
      status: "finalizada",
      nota_geral: notaGeral,
      notas_por_competencia: notasPorCompetencia,
      falhas_criticas_count: falhasCriticas.length,
      ...(assinaturas?.avaliadoPath ? { assinatura_avaliado_path: assinaturas.avaliadoPath } : {}),
      ...(assinaturas?.avaliadorPath ? { assinatura_avaliador_path: assinaturas.avaliadorPath } : {}),
      parecer_sugerido: parecerSugerido,
      parecer_final: parecerSugerido,
      finalizada_em: new Date().toISOString(),
      finalizada_por: profile.id,
    })
    .eq("id", aplicacaoId);

  if (error) return { error: error.message };

  revalidatePath(`/aplicacoes/${aplicacaoId}/aplicar`);
  revalidatePath(`/aplicacoes/${aplicacaoId}/raiox`);
  return { success: true };
}

export async function interromperPorSeguranca(aplicacaoId: string, motivo: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("avaliacoes_aplicadas")
    .update({ interrompida_seguranca: true, motivo_interrupcao: motivo })
    .eq("id", aplicacaoId);
  if (error) return { error: error.message };
  return finalizarAplicacao(aplicacaoId, undefined, true);
}

export async function atualizarParecerFinal(
  aplicacaoId: string,
  parecerFinal: Parecer,
  justificativa: string
) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: atual } = await supabase
    .from("avaliacoes_aplicadas")
    .select("parecer_final, parecer_justificativa, status")
    .eq("id", aplicacaoId)
    .single();

  const { error } = await supabase
    .from("avaliacoes_aplicadas")
    .update({ parecer_final: parecerFinal, parecer_justificativa: justificativa })
    .eq("id", aplicacaoId);
  if (error) return { error: error.message };

  if (atual?.status === "finalizada" && atual.parecer_final !== parecerFinal) {
    await supabase.from("audit_log").insert({
      tabela: "avaliacoes_aplicadas",
      registro_id: aplicacaoId,
      acao: "atualizar_parecer_final",
      usuario_id: profile.id,
      antes: { parecer_final: atual.parecer_final, parecer_justificativa: atual.parecer_justificativa },
      depois: { parecer_final: parecerFinal, parecer_justificativa: justificativa },
      motivo: justificativa || null,
    });
  }

  revalidatePath(`/aplicacoes/${aplicacaoId}/raiox`);
  return { success: true };
}

export async function getSignedUrl(bucket: string, path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}

export async function getAuditLog(aplicacaoId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("audit_log")
    .select("*, profiles(nome)")
    .eq("tabela", "respostas_ou_aplicacao")
    .eq("registro_id", aplicacaoId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function corrigirResposta(
  aplicacaoId: string,
  perguntaId: string,
  valor: RespostaValor,
  motivo: string,
  pontuacaoManual?: number | null
) {
  if (!motivo.trim()) return { error: "Informe o motivo da correção." };

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: pergunta } = await supabase
    .from("avaliacao_perguntas")
    .select("*")
    .eq("id", perguntaId)
    .single();
  if (!pergunta) return { error: "Pergunta não encontrada" };

  const { data: respostaAnterior } = await supabase
    .from("respostas")
    .select("*")
    .eq("aplicacao_id", aplicacaoId)
    .eq("pergunta_id", perguntaId)
    .maybeSingle();

  let alternativasCorretas: Set<string> | undefined;
  if (pergunta.tipo === "multipla_escolha" || pergunta.tipo === "multiplas_respostas") {
    const { data: alts } = await supabase
      .from("avaliacao_alternativas")
      .select("id, correta")
      .eq("pergunta_id", perguntaId);
    alternativasCorretas = new Set((alts ?? []).filter((a) => a.correta).map((a) => a.id));
  }

  const pontuacao = calcularPontuacaoResposta(
    pergunta as AvaliacaoPergunta,
    valor,
    alternativasCorretas,
    pontuacaoManual ?? null
  );
  const itemCriticoFalhou = Boolean(pergunta.item_critico) && pontuacao === 0;

  const { error } = await supabase.from("respostas").upsert(
    {
      aplicacao_id: aplicacaoId,
      pergunta_id: perguntaId,
      tipo: pergunta.tipo,
      resposta: valor,
      pontuacao,
      item_critico_falhou: itemCriticoFalhou,
      observacao: respostaAnterior?.observacao ?? null,
      evidencias: respostaAnterior?.evidencias ?? [],
    },
    { onConflict: "aplicacao_id,pergunta_id" }
  );
  if (error) return { error: error.message };

  await supabase.from("audit_log").insert({
    tabela: "respostas_ou_aplicacao",
    registro_id: aplicacaoId,
    acao: "corrigir_resposta",
    usuario_id: profile.id,
    antes: respostaAnterior ? { resposta: respostaAnterior.resposta, pontuacao: respostaAnterior.pontuacao } : null,
    depois: { resposta: valor, pontuacao },
    motivo,
  });

  // Recalcula nota geral / competencias / falhas / parecer com o novo conjunto de respostas.
  const runnerData = await getAplicacaoRunnerData(aplicacaoId);
  if (runnerData) {
    const { secoes, perguntas, respostas, competencias, aplicacao } = runnerData;
    const notaGeral = calcularNotaGeral(secoes, perguntas, respostas);
    const notasPorCompetencia = calcularNotasPorCompetencia(competencias, perguntas, respostas);
    const falhasCriticas = avaliarItensCriticos(perguntas, respostas);
    const parecerSugerido = gerarParecerSugerido({
      notaGeral,
      notaMinima: aplicacao.avaliacoes.nota_minima,
      competencias,
      notasPorCompetencia,
      falhasCriticas,
    });
    await supabase
      .from("avaliacoes_aplicadas")
      .update({
        nota_geral: notaGeral,
        notas_por_competencia: notasPorCompetencia,
        falhas_criticas_count: falhasCriticas.length,
        parecer_sugerido: parecerSugerido,
      })
      .eq("id", aplicacaoId);
  }

  revalidatePath(`/aplicacoes/${aplicacaoId}/raiox`);
  return { success: true, pontuacao };
}
