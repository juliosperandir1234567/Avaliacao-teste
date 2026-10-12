"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";

/** Grava o caminho da assinatura salva do próprio usuário logado (ver migration 0037). */
export async function salvarMinhaAssinatura(path: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sessão expirada. Entre novamente." };
  // Só aceita arquivo dentro da pasta do próprio usuário.
  if (!path.startsWith(`usuarios/${user.id}/`)) return { error: "Caminho de assinatura inválido." };

  const { data: atualizado, error } = await supabase
    .from("profiles")
    .update({ assinatura_path: path })
    .eq("id", user.id)
    .select("id")
    .maybeSingle();
  if (error) return { error: error.message };
  if (!atualizado) return { error: "Não foi possível salvar a assinatura." };
  revalidatePath("/minha-assinatura");
  return { success: true };
}
