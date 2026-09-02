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
      "*, avaliacoes(nome, nota_minima, equipamento_tipo_id), candidatos_externos(nome, telefone, possui_cnh, categoria_cnh, funcao_pretendida, empresas_anteriores, observacoes)"
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
    (p) => !p.equipamento_tipo_id || p.equipamento_tipo_id === aplicacao.avaliacoes.equipamento_tipo_id
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
        nota_minima: number;
        equipamento_tipo_id: string | null;
      };
      candidatos_externos: {
        nome: string;
        telefone: string | null;
        possui_cnh: boolean | null;
        categoria_cnh: string | null;
        funcao_pretendida: string | null;
        empresas_anteriores: string | null;
        observacoes: string | null;
      } | null;
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
  skipAssinaturaCheck = false,
  observacaoFinal?: string,
  parecerEscolhido?: Parecer
) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const runnerData = await getAplicacaoRunnerData(aplicacaoId);
  if (!runnerData) return { error: "Avaliação não encontrada" };

  const { secoes, perguntas, respostas, competencias, aplicacao } = runnerData;

  if (!skipAssinaturaCheck && (!assinaturas?.avaliadoPath || !assinaturas?.avaliadorPath)) {
    return { error: "É necessário coletar a assinatura do avaliado e do avaliador antes de finalizar." };
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
      parecer_final: parecerEscolhido ?? parecerSugerido,
      ...(observacaoFinal ? { parecer_justificativa: observacaoFinal } : {}),
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

export async function getSignedUrl(bucket: string, path: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 10);
  if (error) return null;
  return data.signedUrl;
}
