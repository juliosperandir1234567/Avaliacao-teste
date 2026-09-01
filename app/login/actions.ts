"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/utils/supabase/server";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    redirect("/login?error=Informe e-mail e senha");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    redirect(`/login?error=${encodeURIComponent("E-mail ou senha inválidos")}`);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("ativo")
    .eq("id", data.user.id)
    .single();

  if (profile && !profile.ativo) {
    await supabase.auth.signOut();
    redirect(`/login?error=${encodeURIComponent("Usuário desativado. Fale com um administrador.")}`);
  }

  redirect("/");
}
