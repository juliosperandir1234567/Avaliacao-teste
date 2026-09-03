import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listAvaliacoesPublicadas } from "../../avaliacoes/actions";
import { CandidatoForm } from "@/components/candidato-form";

export default async function NovoCandidatoPage() {
  const profile = await getCurrentProfile();
  if (profile.role === "gestor") redirect("/");

  const avaliacoes = await listAvaliacoesPublicadas();
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <CandidatoForm avaliacoes={avaliacoes.map((a) => ({ id: a.id, nome: a.nome, funcao: a.funcao }))} />
    </div>
  );
}
