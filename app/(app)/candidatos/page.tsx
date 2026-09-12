import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { listCandidatos } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CandidatosTable } from "@/components/candidatos-table";

export default async function CandidatosPage() {
  const profile = await getCurrentProfile();
  if (profile.role === "gestor") redirect("/");

  const candidatos = await listCandidatos();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Candidatos</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/candidatos/importar">Importar em massa</Link>} />
          <Button variant="outline" render={<Link href="/candidatos/rapido">Acesso rápido</Link>} />
          <Button render={<Link href="/candidatos/novo">+ Novo Candidato</Link>} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <CandidatosTable candidatos={candidatos} />
        </CardContent>
      </Card>
    </div>
  );
}
