import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listAvaliacoesPublicadas } from "../../avaliacoes/actions";
import { AcessoRapidoForm } from "@/components/acesso-rapido-form";

export default async function AcessoRapidoPage() {
  const profile = await getCurrentProfile();
  if (profile.role === "gestor") redirect("/");

  const avaliacoes = await listAvaliacoesPublicadas();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <AcessoRapidoForm avaliacoes={avaliacoes.map((a) => ({ id: a.id, nome: a.nome, funcao: a.funcao }))} />
    </div>
  );
}
