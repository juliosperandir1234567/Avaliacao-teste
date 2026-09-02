import Link from "next/link";
import { listCandidatos } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExcluirCandidatoButton } from "@/components/excluir-candidato-button";
import { getCurrentProfile } from "@/lib/auth";
import { APLICACAO_STATUS_LABELS, type AplicacaoStatus } from "@/lib/types";

export default async function CandidatosPage() {
  const [candidatos, profile] = await Promise.all([listCandidatos(), getCurrentProfile()]);
  const ehAdmin = profile.role === "admin";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Candidatos</h1>
        <Button render={<Link href="/candidatos/novo">+ Novo Candidato</Link>} />
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">Tipo</th>
                  <th className="px-4 py-2 font-medium">Função</th>
                  <th className="px-4 py-2 font-medium">Data</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  {ehAdmin ? <th className="px-4 py-2 font-medium">Ações</th> : null}
                </tr>
              </thead>
              <tbody className="divide-y">
                {candidatos.length === 0 ? (
                  <tr>
                    <td colSpan={ehAdmin ? 6 : 5} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhum candidato cadastrado ainda.
                    </td>
                  </tr>
                ) : (
                  candidatos.map((c) => {
                    const candidatoExterno = Array.isArray(c.candidatos_externos)
                      ? c.candidatos_externos[0]
                      : c.candidatos_externos;
                    const nome = c.colaborador_snapshot?.nome ?? candidatoExterno?.nome ?? "-";
                    return (
                      <tr key={c.id} className="hover:bg-muted/40">
                        <td className="px-4 py-2">
                          <Link href={`/aplicacoes/${c.id}/raiox`} className="text-primary hover:underline">
                            {nome}
                          </Link>
                        </td>
                        <td className="px-4 py-2">{c.tipo_pessoa === "interno" ? "Interno" : "Externo"}</td>
                        <td className="px-4 py-2">{c.funcao_avaliada}</td>
                        <td className="px-4 py-2">{new Date(c.data).toLocaleDateString("pt-BR")}</td>
                        <td className="px-4 py-2">
                          <Badge variant={c.status === "finalizada" ? "default" : "secondary"}>
                            {APLICACAO_STATUS_LABELS[c.status as AplicacaoStatus]}
                          </Badge>
                        </td>
                        {ehAdmin ? (
                          <td className="px-4 py-2">
                            <ExcluirCandidatoButton aplicacaoId={c.id} nome={nome} />
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
