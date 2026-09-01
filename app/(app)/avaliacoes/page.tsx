import Link from "next/link";
import { listAvaliacoes } from "./actions";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AvaliacaoRowActions } from "./avaliacao-row-actions";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  rascunho: "outline",
  em_revisao: "secondary",
  publicada: "default",
  inativa: "secondary",
  arquivada: "outline",
};

const STATUS_LABELS: Record<string, string> = {
  rascunho: "Rascunho",
  em_revisao: "Em revisão",
  publicada: "Publicada",
  inativa: "Inativa",
  arquivada: "Arquivada",
};

export default async function AvaliacoesPage() {
  const avaliacoes = await listAvaliacoes();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Banco de Avaliações</h1>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/avaliacoes/equipamentos">Equipamentos</Link>} />
          <Button render={<Link href="/avaliacoes/novo">+ Criar Nova Avaliação</Link>} />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Nome</th>
                  <th className="px-4 py-2 font-medium">Função</th>
                  <th className="px-4 py-2 font-medium">Versão</th>
                  <th className="px-4 py-2 font-medium">Nota mínima</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {avaliacoes.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                      Nenhuma avaliação cadastrada ainda.
                    </td>
                  </tr>
                ) : (
                  avaliacoes.map((a) => (
                    <tr key={a.id} className="hover:bg-muted/40">
                      <td className="px-4 py-2">
                        <Link href={`/avaliacoes/${a.id}/editar`} className="text-primary hover:underline">
                          {a.nome}
                        </Link>
                      </td>
                      <td className="px-4 py-2">{a.funcao}</td>
                      <td className="px-4 py-2">V{a.versao}</td>
                      <td className="px-4 py-2">{Number(a.nota_minima).toFixed(1)}</td>
                      <td className="px-4 py-2">
                        <Badge variant={STATUS_VARIANT[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                      </td>
                      <td className="px-4 py-2">
                        <AvaliacaoRowActions id={a.id} status={a.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
