"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import type { Parecer } from "@/lib/types";

export interface FiltroExportacao {
  dataInicio?: string;
  dataFim?: string;
  matricula?: string;
  avaliacaoId?: string;
  resultado?: Parecer;
  incluirJaExportadas?: boolean;
}

async function buscar(filtros: FiltroExportacao, apenasExportadas: boolean) {
  const supabase = await createClient();
  let query = supabase
    .from("avaliacoes_aplicadas")
    .select(
      "id, status, data, tipo_pessoa, colaborador_snapshot, parecer_final, exportado_em, avaliacoes(nome), candidatos_externos(nome)"
    )
    .eq("status", "finalizada")
    .order(apenasExportadas ? "exportado_em" : "data", { ascending: false })
    .limit(200);

  if (apenasExportadas) {
    query = query.not("exportado_em", "is", null);
  } else if (!filtros.incluirJaExportadas) {
    query = query.is("exportado_em", null);
  }

  if (filtros.dataInicio) query = query.gte("data", filtros.dataInicio);
  if (filtros.dataFim) query = query.lte("data", filtros.dataFim);
  if (filtros.avaliacaoId) query = query.eq("avaliacao_id", filtros.avaliacaoId);
  if (filtros.resultado) query = query.eq("parecer_final", filtros.resultado);
  if (filtros.matricula) {
    query = query.filter("colaborador_snapshot->>matricula", "ilike", `%${filtros.matricula}%`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
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
