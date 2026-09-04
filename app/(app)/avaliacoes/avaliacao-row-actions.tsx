"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { duplicateAvaliacao, deleteAvaliacao, setAvaliacaoStatus } from "./actions";
import type { AvaliacaoStatus } from "@/lib/types";

export function AvaliacaoRowActions({ id, status }: { id: string; status: AvaliacaoStatus }) {
  const [pending, startTransition] = useTransition();
  const podeExcluir = status === "rascunho" || status === "em_revisao";
  const podeAtivarDesativar = status === "publicada" || status === "inativa";

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await duplicateAvaliacao(id);
            if (result?.error) toast.error(result.error);
          })
        }
      >
        Duplicar
      </Button>
      {podeAtivarDesativar ? (
        <Button
          variant="outline"
          size="sm"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const novoStatus = status === "publicada" ? "inativa" : "publicada";
              const result = await setAvaliacaoStatus(id, novoStatus);
              if (result?.error) toast.error(result.error);
              else toast.success(novoStatus === "publicada" ? "Avaliação ativada" : "Avaliação desativada");
            })
          }
        >
          {status === "publicada" ? "Desativar" : "Ativar"}
        </Button>
      ) : null}
      {podeExcluir ? (
        <Button
          variant="outline"
          size="sm"
          className="text-destructive"
          disabled={pending}
          onClick={() => {
            if (!confirm("Excluir esta avaliação? Essa ação não pode ser desfeita.")) return;
            startTransition(async () => {
              const result = await deleteAvaliacao(id);
              if (result?.error) toast.error(result.error);
              else toast.success("Avaliação excluída");
            });
          }}
        >
          Excluir
        </Button>
      ) : null}
    </div>
  );
}
