"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type {
  Avaliacao,
  AvaliacaoAlternativa,
  AvaliacaoCompetencia,
  AvaliacaoPergunta,
  AvaliacaoSecao,
  AvaliacaoStatus,
  AvaliacaoTipo,
  EquipamentoTipo,
} from "@/lib/types";

export interface BuilderPergunta extends Omit<AvaliacaoPergunta, "secao_id"> {
  alternativas: AvaliacaoAlternativa[];
}

export interface BuilderSecao extends AvaliacaoSecao {
  perguntas: BuilderPergunta[];
}

export interface BuilderState {
  avaliacao: Pick<
    Avaliacao,
    | "nome"
    | "funcao"
    | "categoria"
    | "tipo"
    | "descricao"
    | "instrucoes_candidato"
    | "instrucoes_avaliador"
    | "nota_minima"
    | "tempo_maximo_min"
    | "max_tentativas"
    | "exige_assinatura"
    | "possui_itens_criticos"
    | "permite_nova_tentativa"
  >;
  competencias: AvaliacaoCompetencia[];
  secoes: BuilderSecao[];
}

export async function listAvaliacoes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacoes")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Avaliacao[];
}

export async function listAvaliacoesPublicadas() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacoes")
    .select("*")
    .eq("status", "publicada")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as Avaliacao[];
}

export interface BancoQuestaoResultado {
  id: string;
  enunciado: string;
  tipo: string;
  item_critico: boolean;
  peso: number;
  config: Record<string, unknown>;
  equipamento_tipo_id: string | null;
  avaliacao_nome: string;
  avaliacao_funcao: string;
  alternativas: { texto: string; correta: boolean; ordem: number }[];
}

export async function buscarBancoQuestoes(filtros: {
  texto?: string;
  tipo?: string;
  funcao?: string;
}): Promise<BancoQuestaoResultado[]> {
  const supabase = await createClient();

  let query = supabase
    .from("avaliacao_perguntas")
    .select(
      "id, enunciado, tipo, item_critico, peso, config, equipamento_tipo_id, avaliacao_alternativas(texto, correta, ordem), avaliacao_secoes!inner(avaliacoes!inner(nome, funcao))"
    )
    .order("created_at", { ascending: false })
    .limit(50);

  if (filtros.texto) query = query.ilike("enunciado", `%${filtros.texto}%`);
  if (filtros.tipo) query = query.eq("tipo", filtros.tipo);
  if (filtros.funcao) query = query.ilike("avaliacao_secoes.avaliacoes.funcao", `%${filtros.funcao}%`);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return (data ?? []).map((p) => {
    const secao = p.avaliacao_secoes as unknown as { avaliacoes: { nome: string; funcao: string } };
    return {
      id: p.id,
      enunciado: p.enunciado,
      tipo: p.tipo,
      item_critico: p.item_critico,
      peso: p.peso,
      config: p.config,
      equipamento_tipo_id: p.equipamento_tipo_id,
      avaliacao_nome: secao.avaliacoes.nome,
      avaliacao_funcao: secao.avaliacoes.funcao,
      alternativas: (p.avaliacao_alternativas ?? []) as { texto: string; correta: boolean; ordem: number }[],
    };
  });
}

export async function listEquipamentosTipos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamentos_tipos")
    .select("*")
    .order("familia")
    .order("nome");
  if (error) throw new Error(error.message);
  return (data ?? []) as EquipamentoTipo[];
}

export async function createEquipamentoTipo(familia: string, nome: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("equipamentos_tipos")
    .insert({ familia: familia.trim(), nome: nome.trim() })
    .select("*")
    .single();
  if (error) return { error: error.message };
  return { success: true, tipo: data as EquipamentoTipo };
}

export async function createAvaliacaoDraft(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const funcao = String(formData.get("funcao") ?? "").trim();
  if (!nome || !funcao) {
    redirect(`/avaliacoes/novo?error=${encodeURIComponent("Nome e função são obrigatórios")}`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("avaliacoes")
    .insert({ nome, funcao, created_by: user?.id })
    .select("id")
    .single();

  if (error) {
    redirect(`/avaliacoes/novo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/avaliacoes");
  redirect(`/avaliacoes/${data.id}/editar`);
}

export async function getAvaliacaoBuilderData(id: string) {
  const supabase = await createClient();

  const [{ data: avaliacao }, { data: competencias }, { data: secoes }, { data: perguntas }, { data: alternativas }] =
    await Promise.all([
      supabase.from("avaliacoes").select("*").eq("id", id).single(),
      supabase.from("avaliacao_competencias").select("*").eq("avaliacao_id", id),
      supabase.from("avaliacao_secoes").select("*").eq("avaliacao_id", id).order("ordem"),
      supabase
        .from("avaliacao_perguntas")
        .select("*, avaliacao_secoes!inner(avaliacao_id)")
        .eq("avaliacao_secoes.avaliacao_id", id)
        .order("ordem"),
      supabase
        .from("avaliacao_alternativas")
        .select("*, avaliacao_perguntas!inner(secao_id, avaliacao_secoes!inner(avaliacao_id))")
        .eq("avaliacao_perguntas.avaliacao_secoes.avaliacao_id", id)
        .order("ordem"),
    ]);

  if (!avaliacao) return null;

  const perguntasPorSecao = new Map<string, BuilderPergunta[]>();
  for (const p of perguntas ?? []) {
    const alts = (alternativas ?? []).filter((a) => a.pergunta_id === p.id);
    const list = perguntasPorSecao.get(p.secao_id) ?? [];
    list.push({ ...p, alternativas: alts as AvaliacaoAlternativa[] } as BuilderPergunta);
    perguntasPorSecao.set(p.secao_id, list);
  }

  const builderSecoes: BuilderSecao[] = (secoes ?? []).map((s) => ({
    ...s,
    perguntas: perguntasPorSecao.get(s.id) ?? [],
  }));

  return {
    avaliacao: avaliacao as Avaliacao,
    competencias: (competencias ?? []) as AvaliacaoCompetencia[],
    secoes: builderSecoes,
  };
}

export async function saveAvaliacaoBuilder(
  avaliacaoId: string,
  state: BuilderState,
  publicar: boolean
) {
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("avaliacoes")
    .select("status")
    .eq("id", avaliacaoId)
    .single();

  if (current && current.status !== "rascunho" && current.status !== "em_revisao") {
    return { error: "Avaliações publicadas não podem ser editadas. Duplique para criar uma nova versão." };
  }

  if (publicar) {
    const somaPesoSecoes = state.secoes.reduce((acc, s) => acc + Number(s.peso || 0), 0);
    if (state.secoes.length > 0 && Math.abs(somaPesoSecoes - 100) > 0.5) {
      return { error: `A soma dos pesos das seções deve ser 100% (atual: ${somaPesoSecoes}%)` };
    }
    if (state.secoes.every((s) => s.perguntas.length === 0)) {
      return { error: "Adicione ao menos uma pergunta antes de publicar." };
    }
  }

  const { error: updateError } = await supabase
    .from("avaliacoes")
    .update({
      ...state.avaliacao,
      status: publicar ? "publicada" : "rascunho",
      published_at: publicar ? new Date().toISOString() : null,
    })
    .eq("id", avaliacaoId);
  if (updateError) return { error: updateError.message };

  // Wipe-and-reinsert: seguro pois só ocorre enquanto a avaliacao esta em rascunho/em_revisao
  // (avaliacoes publicadas nao sao mais editadas por este fluxo).
  await supabase.from("avaliacao_secoes").delete().eq("avaliacao_id", avaliacaoId);
  await supabase.from("avaliacao_competencias").delete().eq("avaliacao_id", avaliacaoId);

  if (state.competencias.length > 0) {
    const { error } = await supabase.from("avaliacao_competencias").insert(
      state.competencias.map((c) => ({
        id: c.id,
        avaliacao_id: avaliacaoId,
        nome: c.nome,
        nota_minima: c.nota_minima,
      }))
    );
    if (error) return { error: error.message };
  }

  if (state.secoes.length > 0) {
    const { error } = await supabase.from("avaliacao_secoes").insert(
      state.secoes.map((s) => ({
        id: s.id,
        avaliacao_id: avaliacaoId,
        nome: s.nome,
        ordem: s.ordem,
        peso: s.peso,
      }))
    );
    if (error) return { error: error.message };
  }

  const todasPerguntas = state.secoes.flatMap((s) =>
    s.perguntas.map((p) => ({
      id: p.id,
      secao_id: s.id,
      competencia_id: p.competencia_id,
      equipamento_tipo_id: p.equipamento_tipo_id,
      tipo: p.tipo,
      enunciado: p.enunciado,
      peso: p.peso,
      ordem: p.ordem,
      item_critico: p.item_critico,
      criticidade_consequencia: p.criticidade_consequencia,
      config: p.config,
      evidencia_obrigatoria: p.evidencia_obrigatoria,
      observacao_obrigatoria_se_nao: p.observacao_obrigatoria_se_nao,
    }))
  );

  if (todasPerguntas.length > 0) {
    const { error } = await supabase.from("avaliacao_perguntas").insert(todasPerguntas);
    if (error) return { error: error.message };
  }

  const todasAlternativas = state.secoes.flatMap((s) =>
    s.perguntas.flatMap((p) =>
      p.alternativas.map((a) => ({
        id: a.id,
        pergunta_id: p.id,
        texto: a.texto,
        correta: a.correta,
        ordem: a.ordem,
      }))
    )
  );

  if (todasAlternativas.length > 0) {
    const { error } = await supabase.from("avaliacao_alternativas").insert(todasAlternativas);
    if (error) return { error: error.message };
  }

  revalidatePath("/avaliacoes");
  revalidatePath(`/avaliacoes/${avaliacaoId}/editar`);
  return { success: true };
}

export async function setAvaliacaoStatus(id: string, status: AvaliacaoStatus) {
  const supabase = await createClient();
  const { error } = await supabase.from("avaliacoes").update({ status }).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/avaliacoes");
  return { success: true };
}

export async function deleteAvaliacao(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("avaliacoes").delete().eq("id", id);

  if (error) {
    if (error.code === "23503") {
      return {
        error:
          "Esta avaliação já possui aplicações registradas e não pode ser excluída. Use Inativar ou Arquivar em vez disso.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/avaliacoes");
  return { success: true };
}

export async function duplicateAvaliacao(id: string, novoNome?: string) {
  const supabase = await createClient();
  const original = await getAvaliacaoBuilderData(id);
  if (!original) return { error: "Avaliação não encontrada" };

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: novaAvaliacao, error } = await supabase
    .from("avaliacoes")
    .insert({
      nome: novoNome?.trim() || `${original.avaliacao.nome} (cópia)`,
      funcao: original.avaliacao.funcao,
      categoria: original.avaliacao.categoria,
      tipo: original.avaliacao.tipo as AvaliacaoTipo,
      descricao: original.avaliacao.descricao,
      instrucoes_candidato: original.avaliacao.instrucoes_candidato,
      instrucoes_avaliador: original.avaliacao.instrucoes_avaliador,
      nota_minima: original.avaliacao.nota_minima,
      tempo_maximo_min: original.avaliacao.tempo_maximo_min,
      max_tentativas: original.avaliacao.max_tentativas,
      exige_assinatura: original.avaliacao.exige_assinatura,
      possui_itens_criticos: original.avaliacao.possui_itens_criticos,
      permite_nova_tentativa: original.avaliacao.permite_nova_tentativa,
      avaliacao_origem_id: id,
      created_by: user?.id,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  const novaId = novaAvaliacao.id as string;

  const competenciaIdMap = new Map<string, string>();
  const novasCompetencias = original.competencias.map((c) => {
    const novoId = crypto.randomUUID();
    competenciaIdMap.set(c.id, novoId);
    return { id: novoId, avaliacao_id: novaId, nome: c.nome, nota_minima: c.nota_minima };
  });
  if (novasCompetencias.length > 0) {
    await supabase.from("avaliacao_competencias").insert(novasCompetencias);
  }

  for (const secao of original.secoes) {
    const novaSecaoId = crypto.randomUUID();
    await supabase.from("avaliacao_secoes").insert({
      id: novaSecaoId,
      avaliacao_id: novaId,
      nome: secao.nome,
      ordem: secao.ordem,
      peso: secao.peso,
    });

    for (const pergunta of secao.perguntas) {
      const novaPerguntaId = crypto.randomUUID();
      await supabase.from("avaliacao_perguntas").insert({
        id: novaPerguntaId,
        secao_id: novaSecaoId,
        competencia_id: pergunta.competencia_id
          ? competenciaIdMap.get(pergunta.competencia_id) ?? null
          : null,
        equipamento_tipo_id: pergunta.equipamento_tipo_id,
        tipo: pergunta.tipo,
        enunciado: pergunta.enunciado,
        peso: pergunta.peso,
        ordem: pergunta.ordem,
        item_critico: pergunta.item_critico,
        criticidade_consequencia: pergunta.criticidade_consequencia,
        config: pergunta.config,
        evidencia_obrigatoria: pergunta.evidencia_obrigatoria,
        observacao_obrigatoria_se_nao: pergunta.observacao_obrigatoria_se_nao,
      });

      if (pergunta.alternativas.length > 0) {
        await supabase.from("avaliacao_alternativas").insert(
          pergunta.alternativas.map((a) => ({
            id: crypto.randomUUID(),
            pergunta_id: novaPerguntaId,
            texto: a.texto,
            correta: a.correta,
            ordem: a.ordem,
          }))
        );
      }
    }
  }

  revalidatePath("/avaliacoes");
  redirect(`/avaliacoes/${novaId}/editar`);
}
