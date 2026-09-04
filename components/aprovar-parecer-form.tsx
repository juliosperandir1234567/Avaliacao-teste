"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { aprovarAplicacao } from "@/app/(app)/aplicacoes/actions";
import { PARECER_LABELS, type Parecer } from "@/lib/types";

export function AprovarParecerForm({
  aplicacaoId,
  parecerAtual,
  observacaoGestor,
}: {
  aplicacaoId: string;
  parecerAtual: Parecer | null;
  observacaoGestor: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [parecer, setParecer] = useState<Parecer>(parecerAtual === "reprovado" ? "reprovado" : "apto");
  const [observacao, setObservacao] = useState("");

  return (
    <Card className="border-primary/40">
      <CardHeader>
        <CardTitle className="text-base">Aguardando aprovação do avaliador</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          Esta avaliação foi respondida por um gestor e precisa da confirmação de um avaliador (ou
          administrador) antes de virar oficial.
        </p>
        {parecerAtual ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Parecer sugerido pelo gestor: </span>
            <span className={`font-bold ${parecerAtual === "reprovado" ? "text-destructive" : "text-green-600"}`}>
              {PARECER_LABELS[parecerAtual]}
            </span>
          </p>
        ) : null}
        {observacaoGestor ? (
          <p className="text-sm">
            <span className="text-muted-foreground">Observação do gestor: </span>
            {observacaoGestor}
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <Label>Parecer final (avaliador)</Label>
          <Select
            items={{ apto: PARECER_LABELS.apto, reprovado: PARECER_LABELS.reprovado }}
            value={parecer}
            onValueChange={(v) => setParecer(v as Parecer)}
          >
            <SelectTrigger className="h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="apto">{PARECER_LABELS.apto}</SelectItem>
              <SelectItem value="reprovado">{PARECER_LABELS.reprovado}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="observacaoAprovacao">Observação (opcional)</Label>
          <Textarea
            id="observacaoAprovacao"
            value={observacao}
            onChange={(e) => setObservacao(e.target.value)}
            placeholder="Justificativa/observações da aprovação"
          />
        </div>
        <Button
          className="self-end"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await aprovarAplicacao(aplicacaoId, parecer, observacao.trim() || undefined);
              if (result?.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Avaliação aprovada e finalizada");
              router.refresh();
            })
          }
        >
          {pending ? "Aprovando..." : "Aprovar e finalizar"}
        </Button>
      </CardContent>
    </Card>
  );
}
