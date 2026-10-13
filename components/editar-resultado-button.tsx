"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmarSenhaDialog } from "@/components/confirmar-senha-dialog";
import { liberarEdicaoAplicacao } from "@/app/(app)/aplicacoes/actions";

/** Botão "Editar" de Resultados individuais (só admin): pede a senha e abre a edição da prova. */
export function EditarResultadoButton({ aplicacaoId, nome }: { aplicacaoId: string; nome: string }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon-sm" type="button" title="Editar prova" onClick={() => setAberto(true)}>
        <Pencil className="size-4" />
      </Button>
      <ConfirmarSenhaDialog
        open={aberto}
        onOpenChange={setAberto}
        titulo="Editar prova"
        descricao={`Digite sua senha para liberar a edição da prova de ${nome}.`}
        pedirEmail={false}
        variant="default"
        labelAcao="Liberar edição"
        labelPendente="Conferindo..."
        onConfirm={(_email, senha) => liberarEdicaoAplicacao(aplicacaoId, senha)}
        onSuccess={() => router.push(`/aplicacoes/${aplicacaoId}/editar`)}
      />
    </>
  );
}
