import { getCurrentProfile } from "@/lib/auth";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfiguracoesForm } from "@/components/configuracoes-form";
import { MinhaAssinaturaForm } from "@/components/minha-assinatura-form";

// Todos os perfis entram aqui pra cadastrar a própria assinatura;
// "Identidade visual" (logo, fundos) continua só pra admin.
export default async function ConfiguracoesPage() {
  const profile = await getCurrentProfile();
  const isAdmin = profile.role === "admin";
  const supabase = await createClient();

  const [config, { data: perfil }] = await Promise.all([
    isAdmin ? getConfiguracoesPublicas() : Promise.resolve(null),
    supabase.from("profiles").select("assinatura_path").eq("id", profile.id).single(),
  ]);
  const path = (perfil?.assinatura_path as string | null) ?? null;
  const { data: signed } = path
    ? await supabase.storage.from("assinaturas").createSignedUrl(path, 60 * 10)
    : { data: null };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Configurações</h1>
      <Card id="assinatura">
        <CardHeader>
          <CardTitle className="text-base">Minha assinatura — {profile.nome}</CardTitle>
        </CardHeader>
        <CardContent>
          <MinhaAssinaturaForm userId={profile.id} assinaturaUrlInicial={signed?.signedUrl ?? null} />
        </CardContent>
      </Card>
      {isAdmin && config ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Identidade visual</CardTitle>
          </CardHeader>
          <CardContent>
            <ConfiguracoesForm
              nomeEmpresaInicial={config.nomeEmpresa ?? ""}
              logoUrlInicial={config.logoUrl}
              backgroundUrlInicial={config.backgroundUrl}
              menuFundoUrlInicial={config.menuFundoUrl}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
