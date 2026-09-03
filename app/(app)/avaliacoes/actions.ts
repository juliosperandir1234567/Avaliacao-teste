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
    | "descricao"
    | "nota_minima"
    | "max_tentativas"
    | "equipamento_tipo_id"
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

export async function deleteEquipamentoTipo(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("equipamentos_tipos").delete().eq("id", id);
  if (error) {
    if (error.code === "23503") {
      return {
        error: "Este equipamento está em uso em uma avaliação ou pergunta e não pode ser excluído.",
      };
    }
    return { error: error.message };
  }
  revalidatePath("/avaliacoes/equipamentos");
  return { success: true };
}

export async function createAvaliacaoDraft(formData: FormData) {
  const nome = String(formData.get("nome") ?? "").trim();
  const funcao = String(formData.get("funcao") ?? "").trim();
  const equipamentoTipoId = String(formData.get("equipamentoTipoId") ?? "").trim();
  if (!nome || !funcao || !equipamentoTipoId) {
    redirect(
      `/avaliacoes/novo?error=${encodeURIComponent("Equipamento, nome e função são obrigatórios")}`
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from("avaliacoes")
    .insert({ nome, funcao, equipamento_tipo_id: equipamentoTipoId, created_by: user?.id })
    .select("id")
    .single();

  if (error) {
    redirect(`/avaliacoes/novo?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/avaliacoes");
  redirect(`/avaliacoes/${data.id}/editar`);
}

export interface ImportacaoWordPergunta {
  enunciado: string;
  tipo: string;
  alternativas: { texto: string; correta: boolean }[];
  precisaRevisao: boolean;
}

export async function criarAvaliacaoDeImportacaoWord(
  nome: string,
  funcao: string,
  equipamentoTipoId: string,
  perguntas: ImportacaoWordPergunta[],
  checklist: ImportacaoWordPergunta[]
) {
  if (!equipamentoTipoId) return { error: "Selecione o equipamento." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: avaliacao, error } = await supabase
    .from("avaliacoes")
    .insert({
      nome,
      funcao: funcao || nome,
      equipamento_tipo_id: equipamentoTipoId,
      tipo: "mista",
      created_by: user?.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  const avaliacaoId = avaliacao.id as string;

  async function inserirSecao(nomeSecao: string, ordem: number, itens: ImportacaoWordPergunta[]) {
    if (itens.length === 0) return;
    const { data: secao, error: secaoError } = await supabase
      .from("avaliacao_secoes")
      .insert({ avaliacao_id: avaliacaoId, nome: nomeSecao, ordem, peso: 0 })
      .select("id")
      .single();
    if (secaoError || !secao) return;

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const { data: pergunta, error: perguntaError } = await supabase
        .from("avaliacao_perguntas")
        .insert({
          secao_id: secao.id,
          tipo: item.tipo,
          enunciado: item.enunciado,
          peso: 1,
          ordem: i,
          item_critico: false,
          config: item.precisaRevisao ? { precisa_revisao: true } : {},
        })
        .select("id")
        .single();
      if (perguntaError || !pergunta) continue;

      if (item.alternativas.length > 0) {
        await supabase.from("avaliacao_alternativas").insert(
          item.alternativas.map((a, ordem2) => ({
            pergunta_id: pergunta.id,
            texto: a.texto,
            correta: a.correta,
            ordem: ordem2,
          }))
        );
      }
    }
  }

  await inserirSecao("Importado do Word", 0, perguntas);
  await inserirSecao("Checklist (importado)", 1, checklist);

  revalidatePath("/avaliacoes");
  redirect(`/avaliacoes/${avaliacaoId}/editar`);
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

  if (publicar) {
    if (state.secoes.every((s) => s.perguntas.length === 0)) {
      return { error: "Adicione ao menos uma pergunta antes de publicar." };
    }
    const somaPontos = state.secoes.reduce((acc, s) => acc + Number(s.peso || 0), 0);
    if (Math.abs(somaPontos - 10) > 0.05) {
      return { error: `A soma dos pontos das seções deve ser 10 (atual: ${somaPontos})` };
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

  // Upsert em vez de wipe-and-reinsert: uma avaliacao ja aplicada tem respostas apontando
  // pra avaliacao_perguntas (sem cascade), entao apagar e reinserir a secao/pergunta inteira
  // quebra com "duplicate key" (o delete falha pela FK e o insert seguinte colide com a linha
  // que continuou la). Só apagamos secoes/perguntas/alternativas que o usuario de fato removeu
  // da tela, e se a exclusão esbarrar em respostas já registradas, o item fica preservado.
  const secaoIds = state.secoes.map((s) => s.id);
  const perguntaIds = state.secoes.flatMap((s) => s.perguntas.map((p) => p.id));
  const alternativaIds = state.secoes.flatMap((s) => s.perguntas.flatMap((p) => p.alternativas.map((a) => a.id)));

  const [{ data: secoesAntigas }, { data: perguntasAntigas }, { data: alternativasAntigas }] = await Promise.all([
    supabase.from("avaliacao_secoes").select("id, nome").eq("avaliacao_id", avaliacaoId),
    supabase
      .from("avaliacao_perguntas")
      .select("id, enunciado, avaliacao_secoes!inner(avaliacao_id)")
      .eq("avaliacao_secoes.avaliacao_id", avaliacaoId),
    supabase
      .from("avaliacao_alternativas")
      .select("id, avaliacao_perguntas!inner(secao_id, avaliacao_secoes!inner(avaliacao_id))")
      .eq("avaliacao_perguntas.avaliacao_secoes.avaliacao_id", avaliacaoId),
  ]);

  const alternativasRemovidas = (alternativasAntigas ?? [])
    .map((a) => a.id as string)
    .filter((id) => !alternativaIds.includes(id));
  const perguntasRemovidas = (perguntasAntigas ?? [])
    .filter((p) => !perguntaIds.includes(p.id as string))
    .map((p) => ({ id: p.id as string, enunciado: p.enunciado as string }));
  const secoesRemovidas = (secoesAntigas ?? [])
    .filter((s) => !secaoIds.includes(s.id as string))
    .map((s) => ({ id: s.id as string, nome: s.nome as string }));

  const itensNaoRemovidos: string[] = [];
  if (alternativasRemovidas.length > 0) {
    const { error } = await supabase.from("avaliacao_alternativas").delete().in("id", alternativasRemovidas);
    if (error) itensNaoRemovidos.push(`${alternativasRemovidas.length} alternativa(s)`);
  }
  for (const pergunta of perguntasRemovidas) {
    const { error } = await supabase.from("avaliacao_perguntas").delete().eq("id", pergunta.id);
    if (error) itensNaoRemovidos.push(`"${pergunta.enunciado.slice(0, 40)}"`);
  }
  for (const secao of secoesRemovidas) {
    const { error } = await supabase.from("avaliacao_secoes").delete().eq("id", secao.id);
    if (error) itensNaoRemovidos.push(`seção "${secao.nome}"`);
  }

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
    const { error } = await supabase.from("avaliacao_secoes").upsert(
      state.secoes.map((s) => ({
        id: s.id,
        avaliacao_id: avaliacaoId,
        nome: s.nome,
        ordem: s.ordem,
        peso: s.peso,
        escala_checklist: s.escala_checklist,
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
    const { error } = await supabase.from("avaliacao_perguntas").upsert(todasPerguntas);
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
    const { error } = await supabase.from("avaliacao_alternativas").upsert(todasAlternativas);
    if (error) return { error: error.message };
  }

  revalidatePath("/avaliacoes");
  revalidatePath(`/avaliacoes/${avaliacaoId}/editar`);
  return {
    success: true,
    warning:
      itensNaoRemovidos.length > 0
        ? `Não foi possível remover: ${itensNaoRemovidos.join(", ")} — já têm resposta de candidato registrada e foram mantidos na prova.`
        : undefined,
  };
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
      equipamento_tipo_id: original.avaliacao.equipamento_tipo_id,
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
      escala_checklist: secao.escala_checklist,
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
