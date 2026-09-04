"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { Parecer } from "@/lib/types";

export interface FiltroExportacao {
  dataInicio?: string;
  dataFim?: string;
  avaliacaoId?: string;
  resultado?: Parecer;
  incluirJaExportadas?: boolean;
  codigo?: string;
  cpfOuNome?: string;
}

interface AplicacaoExportRow {
  id: string;
  tipo_pessoa: "interno" | "externo";
  colaborador_snapshot: { nome: string; matricula: string } | null;
  candidatos_externos: { nome: string; cpf: string | null } | { nome: string; cpf: string | null }[] | null;
}

function bateFiltroIdentidade(a: AplicacaoExportRow, codigo?: string, cpfOuNome?: string) {
  const externo = Array.isArray(a.candidatos_externos) ? a.candidatos_externos[0] : a.candidatos_externos;
  if (codigo) {
    const matricula = a.colaborador_snapshot?.matricula ?? "";
    if (!matricula.toLowerCase().includes(codigo.trim().toLowerCase())) return false;
  }
  if (cpfOuNome) {
    const alvo = cpfOuNome.trim().toLowerCase();
    const nome = (a.tipo_pessoa === "interno" ? a.colaborador_snapshot?.nome : externo?.nome) ?? "";
    const cpf = externo?.cpf ?? "";
    if (!nome.toLowerCase().includes(alvo) && !cpf.toLowerCase().includes(alvo)) return false;
  }
  return true;
}

async function buscar(filtros: FiltroExportacao, apenasExportadas: boolean) {
  const supabase = await createClient();
  const temFiltroIdentidade = Boolean(filtros.codigo || filtros.cpfOuNome);
  let query = supabase
    .from("avaliacoes_aplicadas")
    .select(
      "id, status, data, tipo_pessoa, colaborador_snapshot, parecer_final, exportado_em, avaliacoes(nome), candidatos_externos(nome, cpf)"
    )
    .eq("status", "finalizada")
    .order(apenasExportadas ? "exportado_em" : "data", { ascending: false })
    // Código/CPF/nome são filtrados em memória depois (matrícula é jsonb, cpf é de tabela
    // relacionada) — busca mais linhas nesse caso pra não perder resultado por causa do limite.
    .limit(temFiltroIdentidade ? 2000 : 200);

  if (apenasExportadas) {
    query = query.not("exportado_em", "is", null);
  } else if (!filtros.incluirJaExportadas) {
    query = query.is("exportado_em", null);
  }

  if (filtros.dataInicio) query = query.gte("data", filtros.dataInicio);
  if (filtros.dataFim) query = query.lte("data", filtros.dataFim);
  if (filtros.avaliacaoId) query = query.eq("avaliacao_id", filtros.avaliacaoId);
  if (filtros.resultado) query = query.eq("parecer_final", filtros.resultado);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const linhas = ((data ?? []) as unknown as AplicacaoExportRow[]).filter((a) =>
    bateFiltroIdentidade(a, filtros.codigo, filtros.cpfOuNome)
  );
  return temFiltroIdentidade ? linhas.slice(0, 200) : linhas;
}

export async function listarParaExportar(filtros: FiltroExportacao) {
  return buscar(filtros, false);
}

export async function listarExportadas(filtros: FiltroExportacao) {
  return buscar(filtros, true);
}

export async function limparExportacao(ids: string[]) {
  if (ids.length === 0) return { success: true };
  const supabase = await createClient();
  const { error } = await supabase.from("avaliacoes_aplicadas").update({ exportado_em: null }).in("id", ids);
  if (error) return { error: error.message };
  revalidatePath("/dashboard/exportar");
  return { success: true };
}
