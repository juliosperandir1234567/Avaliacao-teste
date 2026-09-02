import Link from "next/link";
import { listCandidatos } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CandidatosTable } from "@/components/candidatos-table";

export default async function CandidatosPage() {
  const candidatos = await listCandidatos();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Candidatos</h1>
        <Button render={<Link href="/candidatos/novo">+ Novo Candidato</Link>} />
      </div>

      <Card>
        <CardContent className="p-0">
          <CandidatosTable candidatos={candidatos} />
        </CardContent>
      </Card>
    </div>
  );
}
