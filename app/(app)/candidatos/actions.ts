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
  observacoes: z.string().trim().optional(),
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
          observacoes: data.observacoes || null,
        },
        { onConflict: "matricula" }
      )
      .select("id, matricula, nome, cargo, estrutura, possui_cnh, categoria_cnh, observacoes")
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
      observacoes: colaborador.observacoes,
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

export async function excluirCandidatos(
  aplicacaoIds: string[],
  emailAdmin: string,
  senha: string
): Promise<{ error?: string }> {
  if (!emailAdmin || !senha) return { error: "Digite o e-mail e a senha do administrador." };
  if (aplicacaoIds.length === 0) return { error: "Nenhum candidato selecionado." };

  // Qualquer papel pode clicar em excluir, mas a exclusao so acontece autenticada como um
  // admin de verdade -- por isso reautentica com as credenciais digitadas (nao a sessao atual)
  // e usa esse client (ja com a sessao do admin) pra fazer a exclusao, respeitando a RLS.
  const verifyClient = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  );
  const { data: authData, error: authError } = await verifyClient.auth.signInWithPassword({
    email: emailAdmin,
    password: senha,
  });
  if (authError || !authData.user) return { error: "E-mail ou senha incorretos." };

  const { data: perfilInformado } = await verifyClient
    .from("profiles")
    .select("role")
    .eq("id", authData.user.id)
    .single();
  if (perfilInformado?.role !== "admin") return { error: "Essas credenciais não pertencem a um administrador." };

  const { error } = await verifyClient.from("avaliacoes_aplicadas").delete().in("id", aplicacaoIds);
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
