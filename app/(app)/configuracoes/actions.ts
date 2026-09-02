"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/lib/auth";

export async function updateConfiguracoes(input: {
  nomeEmpresa?: string;
  logoPath?: string;
  backgroundPath?: string;
}) {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") return { error: "Apenas administradores podem alterar as configurações." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({
      ...(input.nomeEmpresa !== undefined ? { nome_empresa: input.nomeEmpresa || null } : {}),
      ...(input.logoPath !== undefined ? { logo_path: input.logoPath || null } : {}),
      ...(input.backgroundPath !== undefined ? { background_path: input.backgroundPath || null } : {}),
      updated_by: profile.id,
    })
    .eq("id", 1);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { success: true };
}
