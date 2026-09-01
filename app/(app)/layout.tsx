import { getCurrentProfile } from "@/lib/auth";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { AppShell } from "@/components/app-shell";
import { Toaster } from "@/components/ui/sonner";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const [profile, config] = await Promise.all([getCurrentProfile(), getConfiguracoesPublicas()]);

  return (
    <AppShell profile={profile} logoUrl={config.logoUrl} nomeEmpresa={config.nomeEmpresa}>
      {children}
      <Toaster />
    </AppShell>
  );
}
