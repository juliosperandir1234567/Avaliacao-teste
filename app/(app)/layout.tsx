import { getCurrentProfile } from "@/lib/auth";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { createClient } from "@/utils/supabase/server";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const [profile, config, { count: pendenciasCount }] = await Promise.all([
    getCurrentProfile(),
    getConfiguracoesPublicas(),
    supabase.from("avaliacoes_aplicadas").select("id", { count: "exact", head: true }).eq("status", "pendente"),
  ]);

  return (
    <AppShell
      profile={profile}
      logoUrl={config.logoUrl}
      nomeEmpresa={config.nomeEmpresa}
      pendenciasCount={pendenciasCount ?? 0}
    >
      {children}
      <Toaster />
    </AppShell>
  );
}
