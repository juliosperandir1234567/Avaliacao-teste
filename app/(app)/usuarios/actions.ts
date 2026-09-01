"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient, isAdminClientDisponivel } from "@/utils/supabase/admin";
import { getCurrentProfile } from "@/lib/auth";
import type { UserRole } from "@/lib/types";

const ROLES: UserRole[] = ["admin", "avaliador", "recrutamento", "gestor"];

async function exigirAdmin() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") throw new Error("Apenas administradores.");
  return profile;
}

export async function listUsuarios() {
  await exigirAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("id, nome, email, role, ativo")
    .order("nome");
  if (error) throw new Error(error.message);
  return data;
}

export async function criacaoDeUsuarioDisponivel() {
  return isAdminClientDisponivel();
}

const criarUsuarioSchema = z.object({
  nome: z.string().trim().min(1, "Nome é obrigatório"),
  email: z.string().trim().email("E-mail inválido"),
  senha: z.string().min(6, "Senha precisa ter ao menos 6 caracteres"),
  role: z.enum(["admin", "avaliador", "recrutamento", "gestor"]),
});

export async function criarUsuario(input: z.infer<typeof criarUsuarioSchema>) {
  await exigirAdmin();

  if (!isAdminClientDisponivel()) {
    return { error: "Criação de login não está disponível (Secret Key não configurada)." };
  }

  const parsed = criarUsuarioSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: { nome: parsed.data.nome },
  });

  if (error) return { error: error.message };

  const supabase = await createClient();
  const { error: roleError } = await supabase
    .from("profiles")
    .update({ role: parsed.data.role, nome: parsed.data.nome })
    .eq("id", data.user.id);

  if (roleError) return { error: roleError.message };

  revalidatePath("/usuarios");
  return { success: true };
}

export async function atualizarUsuario(
  id: string,
  input: { role?: UserRole; ativo?: boolean; nome?: string }
) {
  await exigirAdmin();
  if (input.role && !ROLES.includes(input.role)) return { error: "Papel inválido" };

  const supabase = await createClient();
  const { error } = await supabase.from("profiles").update(input).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/usuarios");
  return { success: true };
}
