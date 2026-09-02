"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

const externoSchema = z.object({
  tipoPessoa: z.literal("externo"),
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  telefone: z.string().trim().optional(),
  possuiCnh: z.boolean().optional(),
  categoriaCnh: z.string().trim().optional(),
  avaliacaoId: z.string().trim().min(1, "Selecione a avaliação"),
  ultimoEmprego: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
});

const internoSchema = z.object({
  tipoPessoa: z.literal("interno"),
  matricula: z.string().trim().min(1, "Código é obrigatório"),
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  cargo: z.string().trim().min(1, "Função é obrigatória"),
  estrutura: z.string().trim().min(1, "Estrutura é obrigatória"),
  possuiCnh: z.boolean().optional(),
  categoriaCnh: z.string().trim().optional(),
  avaliacaoId: z.string().trim().min(1, "Selecione a avaliação"),
});

const candidatoSchema = z.discriminatedUnion("tipoPessoa", [externoSchema, internoSchema]);
export type CandidatoInput = z.infer<typeof candidatoSchema>;

export async function criarCandidatoEPendencia(input: CandidatoInput): Promise<{ error?: string }> {
  const parsed = candidatoSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = parsed.data;

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: avaliacao, error: avError } = await supabase
    .from("avaliacoes")
    .select("versao, funcao")
    .eq("id", data.avaliacaoId)
    .eq("status", "publicada")
    .single();
  if (avError || !avaliacao) return { error: "Avaliação inválida." };

  let candidatoExternoId: string | null = null;
  let colaboradorId: string | null = null;
  let colaboradorSnapshot = null;

  if (data.tipoPessoa === "externo") {
    const { data: candidato, error } = await supabase
      .from("candidatos_externos")
      .insert({
        nome: data.nome,
        telefone: data.telefone || null,
        possui_cnh: data.possuiCnh ?? null,
        categoria_cnh: data.categoriaCnh || null,
        funcao_pretendida: avaliacao.funcao,
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
        {
          matricula: data.matricula,
          nome: data.nome,
          cargo: data.cargo,
          estrutura: data.estrutura,
          possui_cnh: data.possuiCnh ?? null,
          categoria_cnh: data.categoriaCnh || null,
        },
        { onConflict: "matricula" }
      )
      .select("id, matricula, nome, cargo, estrutura, possui_cnh, categoria_cnh")
      .single();
    if (error) return { error: error.message };
    colaboradorId = colaborador.id as string;
    colaboradorSnapshot = {
      matricula: colaborador.matricula,
      nome: colaborador.nome,
      cargo: colaborador.cargo,
      estrutura: colaborador.estrutura,
      possui_cnh: colaborador.possui_cnh,
      categoria_cnh: colaborador.categoria_cnh,
    };
  }

  const { error } = await supabase.from("avaliacoes_aplicadas").insert({
    avaliacao_id: data.avaliacaoId,
    avaliacao_versao: avaliacao.versao,
    tipo_pessoa: data.tipoPessoa,
    colaborador_id: colaboradorId,
    colaborador_snapshot: colaboradorSnapshot,
    candidato_externo_id: candidatoExternoId,
    funcao_avaliada: avaliacao.funcao,
    criado_por: profile.id,
  });
  if (error) return { error: error.message };

  redirect("/");
}

export async function excluirCandidato(aplicacaoId: string, senha: string): Promise<{ error?: string }> {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") return { error: "Apenas administradores podem excluir candidatos." };
  if (!senha) return { error: "Digite sua senha." };

  const verifyClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { error: authError } = await verifyClient.auth.signInWithPassword({
    email: profile.email,
    password: senha,
  });
  if (authError) return { error: "Senha incorreta." };

  const supabase = await createClient();
  const { error } = await supabase.from("avaliacoes_aplicadas").delete().eq("id", aplicacaoId);
  if (error) return { error: error.message };

  revalidatePath("/candidatos");
  revalidatePath("/");
  return {};
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
