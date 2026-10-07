"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { salvarParecerTexto } from "@/app/(app)/aplicacoes/actions";

/**
 * Parecer da análise com edição: mostra o texto salvo (se o avaliador já editou) ou o automático,
 * e deixa reescrever. "Usar texto automático" apaga a edição e volta a seguir as regras.
 */
export function ParecerEditavel({
  aplicacaoId,
  textoAutomatico,
  textoSalvo,
}: {
  aplicacaoId: string;
  textoAutomatico: string;
  textoSalvo: string | null;
}) {
  const [salvo, setSalvo] = useState(textoSalvo);
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState("");
  const [pending, startTransition] = useTransition();
  const textoAtual = salvo ?? textoAutomatico;

  function salvar(texto: string | null) {
    startTransition(async () => {
      const result = await salvarParecerTexto(aplicacaoId, texto);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSalvo(texto?.trim() || null);
      setEditando(false);
      toast.success(texto ? "Parecer salvo" : "Parecer voltou ao texto automático");
    });
  }

  if (editando) {
    return (
      <div className="flex flex-col gap-2">
        <Textarea
          value={rascunho}
          onChange={(e) => setRascunho(e.target.value)}
          className="min-h-56 text-sm"
          autoFocus
        />
        <div className="flex flex-wrap justify-end gap-2">
          {salvo !== null ? (
            <Button variant="ghost" size="sm" disabled={pending} onClick={() => salvar(null)}>
              Usar texto automático
            </Button>
          ) : null}
          <Button variant="outline" size="sm" disabled={pending} onClick={() => setEditando(false)}>
            Cancelar
          </Button>
          <Button size="sm" disabled={pending || !rascunho.trim()} onClick={() => salvar(rascunho)}>
            {pending ? "Salvando..." : "Salvar parecer"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1">
      <p className="whitespace-pre-line text-muted-foreground">{textoAtual}</p>
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">{salvo !== null ? "Editado pelo avaliador" : ""}</span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setRascunho(textoAtual);
            setEditando(true);
          }}
        >
          <Pencil className="size-3.5" /> Editar parecer
        </Button>
      </div>
    </div>
  );
}
