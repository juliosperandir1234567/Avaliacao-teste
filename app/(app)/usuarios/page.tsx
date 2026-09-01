import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listUsuarios, criacaoDeUsuarioDisponivel } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UsuariosTable } from "./usuarios-table";
import { NovoUsuarioForm } from "./novo-usuario-form";

export default async function UsuariosPage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin") redirect("/");

  const [usuarios, podeCriar] = await Promise.all([listUsuarios(), criacaoDeUsuarioDisponivel()]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Usuários</h1>
        {podeCriar ? <NovoUsuarioForm /> : null}
      </div>

      {!podeCriar ? (
        <p className="text-sm text-muted-foreground">
          Criação de login novo ainda depende de convidar manualmente pelo painel do Supabase
          (Authentication → Add user). Depois disso, defina o papel do usuário aqui.
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Todos os usuários</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <UsuariosTable usuarios={usuarios} meuId={profile.id} />
        </CardContent>
      </Card>
    </div>
  );
}
