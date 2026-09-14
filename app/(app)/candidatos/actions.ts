"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

/** Upsert por matrícula (mesma pessoa reaplicando/sendo reimportada não duplica) -- usado pelo
 * cadastro individual, acesso rápido e importação em massa. */
async function upsertColaborador(
  supabase: SupabaseClient,
  input: { matricula: string; nome: string; cargo: string; estrutura: string; categoriaCnh?: string | null; observacoes?: string | null }
) {
  const { data, error } = await supabase
    .from("colaboradores")
    .upsert(
      {
        matricula: input.matricula,
        nome: input.nome,
        cargo: input.cargo,
        estrutura: input.estrutura,
        categoria_cnh: input.categoriaCnh || null,
        observacoes: input.observacoes || null,
      },
      { onConflict: "matricula" }
    )
    .select("id, matricula, nome, cargo, estrutura, categoria_cnh, observacoes")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return {
    ok: true as const,
    id: data.id as string,
    snapshot: {
      matricula: data.matricula as string,
      nome: data.nome as string,
      cargo: data.cargo as string,
      estrutura: data.estrutura as string,
      categoria_cnh: data.categoria_cnh as string | null,
      observacoes: data.observacoes as string | null,
    },
  };
}

/** Upsert por matrícula -- mesmo motivo do upsertColaborador acima. */
async function upsertCandidatoExterno(
  supabase: SupabaseClient,
  input: { matricula: string | null; nome: string; cpf?: string | null; categoriaCnh?: string | null; observacoes?: string | null },
  funcaoPretendida: string,
  createdBy: string
) {
  const { data, error } = await supabase
    .from("candidatos_externos")
    .upsert(
      {
        matricula: input.matricula,
        nome: input.nome,
        cpf: input.cpf || null,
        categoria_cnh: input.categoriaCnh || null,
        funcao_pretendida: funcaoPretendida,
        observacoes: input.observacoes || null,
        created_by: createdBy,
      },
      { onConflict: "matricula" }
    )
    .select("id")
    .single();
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, id: data.id as string };
}

// Matrícula, nome e outros campos de identificação sempre gravados em maiúsculo -- observações
// fica de fora (texto livre, maiúsculo prejudicaria a leitura).
const maiusc = (msg: string) => z.string().trim().min(1, msg).transform((v) => v.toUpperCase());
const maiuscOpcional = () =>
  z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v.toUpperCase() : v));

const externoSchema = z.object({
  tipoPessoa: z.literal("externo"),
  matricula: maiuscOpcional(),
  nome: maiusc("Nome é obrigatório"),
  cpf: maiuscOpcional(),
  categoriaCnh: maiuscOpcional(),
  avaliacaoId: z.string().trim().min(1, "Selecione a avaliação"),
  observacoes: z.string().trim().optional(),
});

const internoSchema = z.object({
  tipoPessoa: z.literal("interno"),
  matricula: maiusc("Código é obrigatório"),
  nome: maiusc("Nome é obrigatório"),
  cargo: maiusc("Função é obrigatória"),
  estrutura: maiusc("Estrutura é obrigatória"),
  categoriaCnh: maiuscOpcional(),
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
    const resultado = await upsertCandidatoExterno(
      supabase,
      { ...data, matricula: data.matricula || null },
      avaliacao.funcao,
      profile.id
    );
    if (!resultado.ok) return { error: resultado.error };
    candidatoExternoId = resultado.id;
  } else {
    const resultado = await upsertColaborador(supabase, data);
    if (!resultado.ok) return { error: resultado.error };
    colaboradorId = resultado.id;
    colaboradorSnapshot = resultado.snapshot;
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

const acessoRapidoSchema = z
  .object({
    tipoPessoa: z.enum(["interno", "externo"]),
    nome: maiusc("Nome é obrigatório"),
    matricula: maiuscOpcional(),
    avaliacaoId: z.string().trim().min(1, "Selecione a avaliação"),
  })
  .refine((d) => d.tipoPessoa === "externo" || (d.matricula && d.matricula.length > 0), {
    message: "Matrícula é obrigatória para teste interno",
    path: ["matricula"],
  });
export type AcessoRapidoInput = z.infer<typeof acessoRapidoSchema>;

/** Prova sem cadastro completo. Externo: só nome (sempre cria um candidato novo, sem tentar
 * casar com um já existente -- nome sozinho não é uma chave confiável). Interno: nome +
 * matrícula -- se a matrícula já existir (cadastrada na mão ou importada em massa), reaproveita
 * os dados reais dela (ignora o nome digitado aqui); senão cria um colaborador novo com o nome
 * digitado. Cai direto na prova (claimPendenciaSeNecessario assume a pendência ao abrir /aplicar). */
export async function criarAcessoRapido(input: AcessoRapidoInput): Promise<{ error?: string }> {
  const parsed = acessoRapidoSchema.safeParse(input);
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
  let aplicacaoId: string;

  if (data.tipoPessoa === "externo") {
    const resultado = await upsertCandidatoExterno(
      supabase,
      { matricula: null, nome: data.nome },
      avaliacao.funcao,
      profile.id
    );
    if (!resultado.ok) return { error: resultado.error };
    candidatoExternoId = resultado.id;
  } else {
    const matricula = data.matricula!;
    const { data: existente } = await supabase
      .from("colaboradores")
      .select("id, matricula, nome, cargo, estrutura, categoria_cnh, observacoes")
      .eq("matricula", matricula)
      .maybeSingle();
    if (existente) {
      colaboradorId = existente.id as string;
      colaboradorSnapshot = {
        matricula: existente.matricula,
        nome: existente.nome,
        cargo: existente.cargo,
        estrutura: existente.estrutura,
        categoria_cnh: existente.categoria_cnh,
        observacoes: existente.observacoes,
      };
    } else {
      const resultado = await upsertColaborador(supabase, {
        matricula,
        nome: data.nome,
        cargo: avaliacao.funcao,
        estrutura: "-",
      });
      if (!resultado.ok) return { error: resultado.error };
      colaboradorId = resultado.id;
      colaboradorSnapshot = resultado.snapshot;
    }
  }

  const { data: aplicacaoCriada, error } = await supabase
    .from("avaliacoes_aplicadas")
    .insert({
      avaliacao_id: data.avaliacaoId,
      avaliacao_versao: avaliacao.versao,
      tipo_pessoa: data.tipoPessoa,
      colaborador_id: colaboradorId,
      colaborador_snapshot: colaboradorSnapshot,
      candidato_externo_id: candidatoExternoId,
      funcao_avaliada: avaliacao.funcao,
      criado_por: profile.id,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  aplicacaoId = aplicacaoCriada.id as string;

  redirect(`/aplicacoes/${aplicacaoId}/aplicar`);
}

const linhaImportacaoSchema = z.object({
  tipoPessoa: z.enum(["interno", "externo"]),
  matricula: maiusc("Matrícula é obrigatória"),
  nome: maiusc("Nome é obrigatório"),
  cargo: maiuscOpcional(),
  estrutura: maiuscOpcional(),
  cpf: maiuscOpcional(),
  categoriaCnh: maiuscOpcional(),
  observacoes: z.string().trim().optional(),
  avaliacaoNome: z.string().trim().min(1, "Tipo de teste é obrigatório"),
});
export type LinhaImportacao = z.infer<typeof linhaImportacaoSchema>;

/** Importa candidatos em massa (linhas já validadas no cliente -- ver ImportarCandidatosForm).
 * Cada linha resolve o "tipo de teste" (nome da avaliação) pra uma avaliação publicada e faz o
 * mesmo upsert por matrícula do cadastro individual, uma aplicação por linha. Loga o resultado em
 * import_batches (tabela já existia no schema, sem nada que a usasse até agora). */
export async function importarCandidatosLote(
  linhas: LinhaImportacao[]
): Promise<{ error?: string; novos: number; existentes: number; erros: { linha: number; motivo: string }[] }> {
  if (linhas.length === 0) return { error: "Nenhuma linha pra importar.", novos: 0, existentes: 0, erros: [] };

  const supabase = await createClient();
  const profile = await getCurrentProfile();

  const { data: avaliacoesPublicadas } = await supabase
    .from("avaliacoes")
    .select("id, nome, versao, funcao")
    .eq("status", "publicada");
  const avaliacaoPorNome = new Map(
    (avaliacoesPublicadas ?? []).map((a) => [a.nome.trim().toLowerCase(), a])
  );

  let novos = 0;
  let existentes = 0;
  const erros: { linha: number; motivo: string }[] = [];

  for (let i = 0; i < linhas.length; i++) {
    const numeroLinha = i + 2; // +1 (0-index) +1 (cabeçalho)
    const parsed = linhaImportacaoSchema.safeParse(linhas[i]);
    if (!parsed.success) {
      erros.push({ linha: numeroLinha, motivo: parsed.error.issues[0].message });
      continue;
    }
    const linha = parsed.data;
    const avaliacao = avaliacaoPorNome.get(linha.avaliacaoNome.trim().toLowerCase());
    if (!avaliacao) {
      erros.push({ linha: numeroLinha, motivo: `Tipo de teste "${linha.avaliacaoNome}" não encontrado (verifique o nome exato de uma avaliação publicada).` });
      continue;
    }

    let candidatoExternoId: string | null = null;
    let colaboradorId: string | null = null;
    let colaboradorSnapshot = null;
    let jaExistia = false;

    if (linha.tipoPessoa === "externo") {
      const { data: existente } = await supabase
        .from("candidatos_externos")
        .select("id")
        .eq("matricula", linha.matricula)
        .maybeSingle();
      jaExistia = Boolean(existente);
      const resultado = await upsertCandidatoExterno(supabase, linha, avaliacao.funcao, profile.id);
      if (!resultado.ok) {
        erros.push({ linha: numeroLinha, motivo: resultado.error });
        continue;
      }
      candidatoExternoId = resultado.id;
    } else {
      if (!linha.cargo || !linha.estrutura) {
        erros.push({ linha: numeroLinha, motivo: "Função e Estrutura são obrigatórios pra teste interno." });
        continue;
      }
      const { data: existente } = await supabase
        .from("colaboradores")
        .select("id")
        .eq("matricula", linha.matricula)
        .maybeSingle();
      jaExistia = Boolean(existente);
      const resultado = await upsertColaborador(supabase, {
        matricula: linha.matricula,
        nome: linha.nome,
        cargo: linha.cargo,
        estrutura: linha.estrutura,
        categoriaCnh: linha.categoriaCnh,
        observacoes: linha.observacoes,
      });
      if (!resultado.ok) {
        erros.push({ linha: numeroLinha, motivo: resultado.error });
        continue;
      }
      colaboradorId = resultado.id;
      colaboradorSnapshot = resultado.snapshot;
    }

    const { error } = await supabase.from("avaliacoes_aplicadas").insert({
      avaliacao_id: avaliacao.id,
      avaliacao_versao: avaliacao.versao,
      tipo_pessoa: linha.tipoPessoa,
      colaborador_id: colaboradorId,
      colaborador_snapshot: colaboradorSnapshot,
      candidato_externo_id: candidatoExternoId,
      funcao_avaliada: avaliacao.funcao,
      criado_por: profile.id,
    });
    if (error) {
      erros.push({ linha: numeroLinha, motivo: error.message });
      continue;
    }

    if (jaExistia) existentes++;
    else novos++;
  }

  await supabase.from("import_batches").insert({
    tipo: "candidatos",
    total: linhas.length,
    novos,
    existentes,
    alterados: existentes,
    erros: erros.length,
    created_by: profile.id,
  });

  revalidatePath("/candidatos");
  revalidatePath("/");
  return { novos, existentes, erros };
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
