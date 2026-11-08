import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";
import type { Profile } from "./types";

// cache(): layout e pagina chamam isso na mesma requisicao -- assim so busca uma vez.
// getClaims() valida o token localmente (sem ida ao servidor de Auth a cada clique).
export const getCurrentProfile = cache(async (): Promise<Profile> => {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (!userId) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, nome, email, role, ativo")
    .eq("id", userId)
    .single();

  if (!profile) {
    redirect("/login");
  }

  return profile as Profile;
});
