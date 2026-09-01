"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PARECER_LABELS, type Parecer } from "@/lib/types";
import { atualizarParecerFinal } from "@/app/(app)/aplicacoes/actions";

export function ParecerFinalForm({
  aplicacaoId,
  parecerFinal,
  justificativa,
  editavel,
}: {
  aplicacaoId: string;
  parecerFinal: Parecer;
  justificativa: string;
  editavel: boolean;
}) {
  const [parecer, setParecer] = useState<Parecer>(parecerFinal);
  const [texto, setTexto] = useState(justificativa);
  const [pending, startTransition] = useTransition();

  if (!editavel) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <p className="font-medium">{PARECER_LABELS[parecerFinal]}</p>
        {justificativa ? <p className="text-muted-foreground">{justificativa}</p> : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Parecer final do avaliador</Label>
        <Select value={parecer} onValueChange={(v) => setParecer(v as Parecer)}>
          <SelectTrigger className="h-10">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.entries(PARECER_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Justificativa / Observações finais</Label>
        <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} />
      </div>
      <Button
        className="self-start"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await atualizarParecerFinal(aplicacaoId, parecer, texto);
            if (result?.error) toast.error(result.error);
            else toast.success("Parecer atualizado");
          })
        }
      >
        {pending ? "Salvando..." : "Confirmar Parecer"}
      </Button>
    </div>
  );
}
