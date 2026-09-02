import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listAvaliacoes } from "@/app/(app)/avaliacoes/actions";
import { ExportarPainel } from "./exportar-painel";

export default async function ExportarPage() {
  const profile = await getCurrentProfile();
  if (profile.role !== "admin" && profile.role !== "recrutamento") redirect("/dashboard");

  const avaliacoes = await listAvaliacoes();

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-semibold">Exportar avaliações (ZIP)</h1>
        <p className="text-sm text-muted-foreground">
          Os PDFs são gerados na hora e organizados em pastas por matrícula dentro do ZIP.
        </p>
      </div>
      <ExportarPainel avaliacoes={avaliacoes.map((a) => ({ id: a.id, nome: a.nome }))} />
    </div>
  );
}
