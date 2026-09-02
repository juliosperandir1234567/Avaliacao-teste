import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfiguracoesForm } from "@/components/configuracoes-form";

export default async function ConfiguracoesPage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/");

  const config = await getConfiguracoesPublicas();

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Identidade visual</CardTitle>
        </CardHeader>
        <CardContent>
          <ConfiguracoesForm
            nomeEmpresaInicial={config.nomeEmpresa ?? ""}
            logoUrlInicial={config.logoUrl}
            backgroundUrlInicial={config.backgroundUrl}
          />
        </CardContent>
      </Card>
    </div>
  );
}
