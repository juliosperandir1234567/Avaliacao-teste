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

export async function excluirUsuario(id: string) {
  const profile = await exigirAdmin();
  if (id === profile.id) return { error: "Você não pode excluir seu próprio usuário." };
  if (!isAdminClientDisponivel()) {
    return { error: "Exclusão de login não está disponível (Secret Key não configurada)." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) {
    // avaliacoes_aplicadas.avaliador_id/finalizada_por referenciam profiles sem cascade —
    // usuario que ja aplicou/aprovou alguma prova nao pode ser excluido de verdade.
    if (error.message.toLowerCase().includes("foreign key") || error.code === "23503") {
      return {
        error:
          "Este usuário já tem provas aplicadas/aprovadas registradas e não pode ser excluído. Use o interruptor \"Ativo\" pra desativar o acesso dele.",
      };
    }
    return { error: error.message };
  }

  revalidatePath("/usuarios");
  return { success: true };
}

function gerarSenhaAleatoria(): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let senha = "";
  for (let i = 0; i < 10; i++) senha += alfabeto[Math.floor(Math.random() * alfabeto.length)];
  return senha;
}

/** Só o admin pode gerar uma nova senha pra outro usuário (não é um fluxo de "esqueci minha
 * senha" por e-mail — o admin gera na hora e repassa pro usuário por fora do sistema). */
export async function gerarNovaSenha(id: string): Promise<{ error?: string; senha?: string }> {
  await exigirAdmin();
  if (!isAdminClientDisponivel()) {
    return { error: "Recurso não disponível (Secret Key não configurada)." };
  }

  const novaSenha = gerarSenhaAleatoria();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, { password: novaSenha });
  if (error) return { error: error.message };

  return { senha: novaSenha };
}
