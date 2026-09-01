import { createClient } from "@/utils/supabase/server";

export interface ConfiguracoesPublicas {
  nomeEmpresa: string | null;
  logoUrl: string | null;
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;

export function publicStorageUrl(bucket: string, path: string) {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

export async function getConfiguracoesPublicas(): Promise<ConfiguracoesPublicas> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("configuracoes")
    .select("nome_empresa, logo_path")
    .eq("id", 1)
    .maybeSingle();

  return {
    nomeEmpresa: data?.nome_empresa ?? null,
    logoUrl: data?.logo_path ? publicStorageUrl("branding", data.logo_path) : null,
  };
}
