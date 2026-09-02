"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ConfirmarSenhaDialog } from "@/components/confirmar-senha-dialog";
import { excluirCandidatos, type listCandidatos } from "@/app/(app)/candidatos/actions";
import { APLICACAO_STATUS_LABELS, type AplicacaoStatus } from "@/lib/types";

type Candidato = Awaited<ReturnType<typeof listCandidatos>>[number];

function nomeDe(c: Candidato) {
  const candidatoExterno = Array.isArray(c.candidatos_externos) ? c.candidatos_externos[0] : c.candidatos_externos;
  return c.colaborador_snapshot?.nome ?? candidatoExterno?.nome ?? "-";
}

export function CandidatosTable({ candidatos }: { candidatos: Candidato[] }) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [idsParaExcluir, setIdsParaExcluir] = useState<string[]>([]);
  const [dialogAberto, setDialogAberto] = useState(false);

  function alternar(id: string) {
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function alternarTodos() {
    setSelecionados((s) => (s.size === candidatos.length ? new Set() : new Set(candidatos.map((c) => c.id))));
  }

  function abrirExclusao(ids: string[]) {
    setIdsParaExcluir(ids);
    setDialogAberto(true);
  }

  const todosSelecionados = candidatos.length > 0 && selecionados.size === candidatos.length;

  return (
    <>
      {selecionados.size > 0 ? (
        <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
          <span className="text-sm text-muted-foreground">{selecionados.size} selecionado(s)</span>
          <Button
            variant="destructive"
            size="sm"
            type="button"
            onClick={() => abrirExclusao([...selecionados])}
          >
            <Trash2 className="size-3.5" /> Excluir selecionados
          </Button>
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="w-10 px-4 py-2">
                <Checkbox checked={todosSelecionados} onCheckedChange={alternarTodos} />
              </th>
              <th className="px-4 py-2 font-medium">Nome</th>
              <th className="px-4 py-2 font-medium">Tipo</th>
              <th className="px-4 py-2 font-medium">Função</th>
              <th className="px-4 py-2 font-medium">Data</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {candidatos.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Nenhum candidato cadastrado ainda.
                </td>
              </tr>
            ) : (
              candidatos.map((c) => {
                const nome = nomeDe(c);
                return (
                  <tr key={c.id} className="hover:bg-muted/40">
                    <td className="px-4 py-2">
                      <Checkbox checked={selecionados.has(c.id)} onCheckedChange={() => alternar(c.id)} />
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/aplicacoes/${c.id}/relatorio`}
                        target="_blank"
                        className="text-primary hover:underline"
                      >
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
                    <td className="px-4 py-2">
                      <Button variant="ghost" size="icon-sm" type="button" onClick={() => abrirExclusao([c.id])}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <ConfirmarSenhaDialog
        open={dialogAberto}
        onOpenChange={setDialogAberto}
        titulo={idsParaExcluir.length > 1 ? `Excluir ${idsParaExcluir.length} candidatos?` : "Excluir candidato?"}
        descricao="Essa ação remove definitivamente a prova/pendência selecionada e não pode ser desfeita. Confirme e-mail e senha de um administrador para continuar."
        onConfirm={(emailAdmin, senha) => excluirCandidatos(idsParaExcluir, emailAdmin, senha)}
        onSuccess={() => {
          toast.success(idsParaExcluir.length > 1 ? "Candidatos excluídos" : "Candidato excluído");
          setSelecionados(new Set());
          router.refresh();
        }}
      />
    </>
  );
}
