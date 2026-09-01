import { createClient as createSupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

/**
 * Client com a Secret Key (service_role) — ignora RLS. Só pode ser usado dentro de
 * server actions (nunca importado por código de client component). Requer
 * SUPABASE_SECRET_KEY no ambiente; use `isAdminClientDisponivel()` antes de chamar.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("SUPABASE_SECRET_KEY não configurada");
  }
  return createSupabaseClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function isAdminClientDisponivel() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}
