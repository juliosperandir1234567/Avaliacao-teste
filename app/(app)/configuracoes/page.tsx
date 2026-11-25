import Link from "next/link";
import { ChevronRight, ClipboardList, PenLine, Settings2, Truck, UserCog } from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfiguracoesForm } from "@/components/configuracoes-form";
import { MinhaAssinaturaForm } from "@/components/minha-assinatura-form";

const ATALHOS_ADMIN = [
  { href: "/usuarios", label: "Usuários", descricao: "Criar logins, trocar papel, gerar nova senha", icon: UserCog },
  { href: "/avaliacoes", label: "Provas", descricao: "Montar, editar e importar provas do Word", icon: ClipboardList },
  { href: "/avaliacoes/equipamentos", label: "Equipamentos", descricao: "Famílias de equipamento das provas", icon: Truck },
];

// Todos os perfis entram aqui pra cadastrar a própria assinatura;
// "Identidade visual" (logo, fundos) e os atalhos de administração são só pra admin.
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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Configurações</h1>
        <p className="text-sm text-muted-foreground">
          {isAdmin ? "Sua assinatura, identidade visual do sistema e atalhos de administração." : "Sua assinatura."}
        </p>
      </div>

      <div className={`grid gap-4 ${isAdmin ? "lg:grid-cols-2" : ""}`}>
        <div className="flex flex-col gap-4">
          <Card id="assinatura">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <PenLine className="size-4" /> Minha assinatura
              </CardTitle>
              <p className="text-xs text-muted-foreground">
                {profile.nome} — usada no botão &quot;Usar minha assinatura&quot; ao finalizar uma avaliação.
              </p>
            </CardHeader>
            <CardContent>
              <MinhaAssinaturaForm userId={profile.id} assinaturaUrlInicial={signed?.signedUrl ?? null} />
            </CardContent>
          </Card>

          {isAdmin ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Settings2 className="size-4" /> Administração
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col divide-y p-0">
                {ATALHOS_ADMIN.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="flex items-center gap-3 px-4 py-3 text-sm hover:bg-muted/50"
                  >
                    <a.icon className="size-4 shrink-0 text-muted-foreground" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-medium">{a.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{a.descricao}</span>
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </CardContent>
            </Card>
          ) : null}
        </div>

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
    </div>
  );
}
