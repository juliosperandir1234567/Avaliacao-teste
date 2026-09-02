"use server";

import { createClient } from "@/utils/supabase/server";
import type { Parecer, TipoPessoa } from "@/lib/types";

export interface DashboardFiltros {
  dataInicio?: string;
  dataFim?: string;
  tipoPessoa?: TipoPessoa;
  avaliacaoId?: string;
  resultado?: Parecer;
  funcao?: string;
}

interface AplicacaoRow {
  id: string;
  avaliacao_id: string;
  tipo_pessoa: TipoPessoa;
  nota_geral: number | null;
  falhas_criticas_count: number;
  parecer_final: Parecer | null;
  data: string;
  funcao_avaliada: string | null;
  colaborador_snapshot: { nome: string } | null;
  candidatos_externos: { nome: string } | null;
  avaliacoes: { nome: string; equipamentos_tipos: { familia: string } | null } | null;
}

const NOTA_BUCKETS = [
  { label: "0,0–4,9", min: 0, max: 4.9 },
  { label: "5,0–5,9", min: 5, max: 5.9 },
  { label: "6,0–6,9", min: 6, max: 6.9 },
  { label: "7,0–7,9", min: 7, max: 7.9 },
  { label: "8,0–8,9", min: 8, max: 8.9 },
  { label: "9,0–10,0", min: 9, max: 10 },
];

export async function getDashboardData(filtros: DashboardFiltros) {
  const supabase = await createClient();

  let query = supabase
    .from("avaliacoes_aplicadas")
    .select(
      "id, avaliacao_id, tipo_pessoa, nota_geral, falhas_criticas_count, parecer_final, data, funcao_avaliada, colaborador_snapshot, candidatos_externos(nome), avaliacoes(nome, equipamentos_tipos(familia))"
    )
    .eq("status", "finalizada")
    .order("data", { ascending: true })
    .limit(5000);

  if (filtros.dataInicio) query = query.gte("data", filtros.dataInicio);
  if (filtros.dataFim) query = query.lte("data", filtros.dataFim);
  if (filtros.tipoPessoa) query = query.eq("tipo_pessoa", filtros.tipoPessoa);
  if (filtros.avaliacaoId) query = query.eq("avaliacao_id", filtros.avaliacaoId);
  if (filtros.resultado) query = query.eq("parecer_final", filtros.resultado);
  if (filtros.funcao) query = query.eq("funcao_avaliada", filtros.funcao);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const aplicacoes = (data ?? []) as unknown as AplicacaoRow[];

  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = new Date().toISOString().slice(0, 7) + "-01";

  const totais = {
    total: aplicacoes.length,
    hoje: aplicacoes.filter((a) => a.data === hoje).length,
    noMes: aplicacoes.filter((a) => a.data >= inicioMes).length,
    internos: aplicacoes.filter((a) => a.tipo_pessoa === "interno").length,
    externos: aplicacoes.filter((a) => a.tipo_pessoa === "externo").length,
    falhasCriticas: aplicacoes.reduce((acc, a) => acc + a.falhas_criticas_count, 0),
  };

  const notas = aplicacoes.filter((a) => a.nota_geral !== null).map((a) => a.nota_geral as number);
  const notaMedia = notas.length > 0 ? notas.reduce((acc, n) => acc + n, 0) / notas.length : null;

  const parecerCount: Record<Parecer, number> = {
    apto: 0,
    apto_acompanhamento: 0,
    reprovado: 0,
    necessita_treinamento: 0,
    nova_avaliacao: 0,
    nao_recomendado: 0,
  };
  for (const a of aplicacoes) {
    if (a.parecer_final) parecerCount[a.parecer_final] += 1;
  }

  const porAvaliacaoMap = new Map<string, { nome: string; notas: number[] }>();
  for (const a of aplicacoes) {
    const entry = porAvaliacaoMap.get(a.avaliacao_id) ?? { nome: a.avaliacoes?.nome ?? "-", notas: [] };
    if (a.nota_geral !== null) entry.notas.push(a.nota_geral);
    porAvaliacaoMap.set(a.avaliacao_id, entry);
  }
  const resultadosPorAvaliacao = [...porAvaliacaoMap.entries()]
    .map(([id, v]) => ({
      id,
      nome: v.nome,
      quantidade: v.notas.length,
      notaMedia: v.notas.length > 0 ? v.notas.reduce((acc, n) => acc + n, 0) / v.notas.length : 0,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const porFuncaoMap = new Map<string, number[]>();
  for (const a of aplicacoes) {
    if (a.nota_geral === null || !a.funcao_avaliada) continue;
    const familia = a.avaliacoes?.equipamentos_tipos?.familia;
    const label = familia ? `${familia} - ${a.funcao_avaliada}` : a.funcao_avaliada;
    const list = porFuncaoMap.get(label) ?? [];
    list.push(a.nota_geral);
    porFuncaoMap.set(label, list);
  }
  const notaPorFuncao = [...porFuncaoMap.entries()]
    .map(([nome, notasFuncao]) => ({
      nome,
      quantidade: notasFuncao.length,
      notaMedia: notasFuncao.reduce((acc, n) => acc + n, 0) / notasFuncao.length,
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

  const resultadosIndividuais = filtros.funcao
    ? aplicacoes
        .map((a) => ({
          nome: (a.tipo_pessoa === "interno" ? a.colaborador_snapshot?.nome : a.candidatos_externos?.nome) ?? "-",
          tipoPessoa: a.tipo_pessoa,
          data: a.data,
          notaGeral: a.nota_geral,
          parecerFinal: a.parecer_final,
        }))
        .sort((a, b) => (b.notaGeral ?? -1) - (a.notaGeral ?? -1))
    : [];

  const distribuicaoNotas = NOTA_BUCKETS.map((b) => ({
    label: b.label,
    quantidade: notas.filter((n) => n >= b.min && n <= b.max).length,
  }));

  const evolucaoMap = new Map<string, number[]>();
  for (const a of aplicacoes) {
    if (a.nota_geral === null) continue;
    const mes = a.data.slice(0, 7);
    const list = evolucaoMap.get(mes) ?? [];
    list.push(a.nota_geral);
    evolucaoMap.set(mes, list);
  }
  const evolucaoTemporal = [...evolucaoMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, notas3]) => ({
      mes,
      notaMedia: Math.round((notas3.reduce((acc, n) => acc + n, 0) / notas3.length) * 10) / 10,
    }));

  // Ranking de falhas: itens críticos com maior índice de falha.
  const aplicacaoIds = aplicacoes.map((a) => a.id);
  let principaisFalhas: { enunciado: string; total: number }[] = [];
  if (aplicacaoIds.length > 0) {
    const { data: falhas } = await supabase
      .from("respostas")
      .select("pergunta_id, avaliacao_perguntas(enunciado)")
      .eq("item_critico_falhou", true)
      .in("aplicacao_id", aplicacaoIds)
      .limit(5000);

    const falhaMap = new Map<string, { enunciado: string; total: number }>();
    for (const f of falhas ?? []) {
      const perguntaInfo = f.avaliacao_perguntas as unknown as { enunciado: string } | null;
      const enunciado = perguntaInfo?.enunciado ?? "-";
      const entry = falhaMap.get(f.pergunta_id) ?? { enunciado, total: 0 };
      entry.total += 1;
      falhaMap.set(f.pergunta_id, entry);
    }
    principaisFalhas = [...falhaMap.values()].sort((a, b) => b.total - a.total).slice(0, 8);
  }

  return {
    totais,
    notaMedia,
    parecerCount,
    resultadosPorAvaliacao,
    notaPorFuncao,
    distribuicaoNotas,
    evolucaoTemporal,
    principaisFalhas,
    resultadosIndividuais,
  };
}

export async function listAvaliacoesParaFiltro() {
  const supabase = await createClient();
  const { data } = await supabase.from("avaliacoes").select("id, nome").order("nome");
  return data ?? [];
}

export async function listFuncoesParaFiltro() {
  const supabase = await createClient();
  const { data } = await supabase.from("avaliacoes").select("funcao").order("funcao");
  const funcoes = [...new Set((data ?? []).map((a) => a.funcao))];
  return funcoes;
}
