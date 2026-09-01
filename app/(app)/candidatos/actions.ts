"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import type { ColaboradorSnapshot, TipoPessoa } from "@/lib/types";

const externoSchema = z.object({
  tipoPessoa: z.literal("externo"),
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  telefone: z.string().trim().optional(),
  possuiCnh: z.boolean().optional(),
  categoriaCnh: z.string().trim().optional(),
  funcaoPretendida: z.string().trim().min(1, "Informe o tipo de teste / função pretendida"),
  ultimoEmprego: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
});

const internoSchema = z.object({
  tipoPessoa: z.literal("interno"),
  matricula: z.string().trim().min(1, "Código é obrigatório"),
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  cargo: z.string().trim().min(1, "Função é obrigatória"),
  estrutura: z.string().trim().min(1, "Estrutura é obrigatória"),
  funcaoPretendida: z.string().trim().min(1, "Informe o tipo de teste / função pretendida"),
});

const candidatoSchema = z.discriminatedUnion("tipoPessoa", [externoSchema, internoSchema]);
export type CandidatoInput = z.infer<typeof candidatoSchema>;

interface AvaliacaoMatch {
  id: string;
  nome: string;
  funcao: string;
}

export interface CriarCandidatoResultado {
  error?: string;
  precisaEscolherAvaliacao?: boolean;
  tipoPessoa?: TipoPessoa;
  colaboradorSnapshot?: ColaboradorSnapshot | null;
  candidatoExternoId?: string | null;
  colaboradorId?: string | null;
  opcoes?: AvaliacaoMatch[];
}

async function criarPendencia(
  supabase: Awaited<ReturnType<typeof createClient>>,
  params: {
    tipoPessoa: TipoPessoa;
    avaliacaoId: string;
    funcaoAvaliada: string;
    candidatoExternoId: string | null;
    colaboradorId: string | null;
    colaboradorSnapshot: ColaboradorSnapshot | null;
    criadoPor: string;
  }
) {
  const { data: avaliacao, error: avErr } = await supabase
    .from("avaliacoes")
    .select("versao")
    .eq("id", params.avaliacaoId)
    .single();
  if (avErr || !avaliacao) return { error: "Avaliação não encontrada." };

  const { error } = await supabase.from("avaliacoes_aplicadas").insert({
    avaliacao_id: params.avaliacaoId,
    avaliacao_versao: avaliacao.versao,
    tipo_pessoa: params.tipoPessoa,
    colaborador_id: params.colaboradorId,
    colaborador_snapshot: params.colaboradorSnapshot,
    candidato_externo_id: params.candidatoExternoId,
    funcao_avaliada: params.funcaoAvaliada,
    criado_por: params.criadoPor,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function criarCandidatoEPendencia(input: CandidatoInput): Promise<CriarCandidatoResultado> {
  const parsed = candidatoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  let candidatoExternoId: string | null = null;
  let colaboradorId: string | null = null;
  let colaboradorSnapshot: ColaboradorSnapshot | null = null;

  if (data.tipoPessoa === "externo") {
    const { data: candidato, error } = await supabase
      .from("candidatos_externos")
      .insert({
        nome: data.nome,
        telefone: data.telefone || null,
        possui_cnh: data.possuiCnh ?? null,
        categoria_cnh: data.categoriaCnh || null,
        funcao_pretendida: data.funcaoPretendida,
        empresas_anteriores: data.ultimoEmprego || null,
        observacoes: data.observacoes || null,
        created_by: profile.id,
      })
      .select("id")
      .single();
    if (error) return { error: error.message };
    candidatoExternoId = candidato.id as string;
  } else {
    const { data: colaborador, error } = await supabase
      .from("colaboradores")
      .upsert(
        { matricula: data.matricula, nome: data.nome, cargo: data.cargo, estrutura: data.estrutura },
        { onConflict: "matricula" }
      )
      .select("id, matricula, nome, cargo, estrutura")
      .single();
    if (error) return { error: error.message };
    colaboradorId = colaborador.id as string;
    colaboradorSnapshot = {
      matricula: colaborador.matricula,
      nome: colaborador.nome,
      cargo: colaborador.cargo,
      estrutura: colaborador.estrutura,
    };
  }

  const { data: avaliacoes, error: avError } = await supabase
    .from("avaliacoes")
    .select("id, nome, funcao")
    .eq("status", "publicada")
    .ilike("funcao", data.funcaoPretendida.trim());

  if (avError) return { error: avError.message };

  if (avaliacoes && avaliacoes.length === 1) {
    const resultado = await criarPendencia(supabase, {
      tipoPessoa: data.tipoPessoa,
      avaliacaoId: avaliacoes[0].id,
      funcaoAvaliada: avaliacoes[0].funcao,
      candidatoExternoId,
      colaboradorId,
      colaboradorSnapshot,
      criadoPor: profile.id,
    });
    if (resultado.error) return { error: resultado.error };
    redirect("/");
  }

  const { data: todas } = await supabase
    .from("avaliacoes")
    .select("id, nome, funcao")
    .eq("status", "publicada")
    .order("nome");

  return {
    precisaEscolherAvaliacao: true,
    tipoPessoa: data.tipoPessoa,
    colaboradorSnapshot,
    candidatoExternoId,
    colaboradorId,
    opcoes: (todas ?? []) as AvaliacaoMatch[],
  };
}

export async function confirmarAvaliacaoManual(input: {
  tipoPessoa: TipoPessoa;
  avaliacaoId: string;
  candidatoExternoId?: string | null;
  colaboradorId?: string | null;
  colaboradorSnapshot?: ColaboradorSnapshot | null;
}) {
  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: avaliacao, error } = await supabase
    .from("avaliacoes")
    .select("funcao")
    .eq("id", input.avaliacaoId)
    .eq("status", "publicada")
    .single();
  if (error || !avaliacao) return { error: "Avaliação inválida." };

  const resultado = await criarPendencia(supabase, {
    tipoPessoa: input.tipoPessoa,
    avaliacaoId: input.avaliacaoId,
    funcaoAvaliada: avaliacao.funcao,
    candidatoExternoId: input.candidatoExternoId ?? null,
    colaboradorId: input.colaboradorId ?? null,
    colaboradorSnapshot: input.colaboradorSnapshot ?? null,
    criadoPor: profile.id,
  });
  if (resultado.error) return resultado;
  redirect("/");
}

export async function listCandidatos() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("avaliacoes_aplicadas")
    .select(
      "id, funcao_avaliada, status, data, tipo_pessoa, colaborador_snapshot, nota_geral, parecer_final, candidatos_externos(nome)"
    )
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data ?? [];
}
