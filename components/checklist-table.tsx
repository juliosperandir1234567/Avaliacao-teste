"use client";

import { useState } from "react";
import { Camera, ChevronDown, ChevronUp, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AvaliacaoPergunta, ChecklistStatus, RespostaValor } from "@/lib/types";

export interface RespostaLocalChecklist {
  valor: RespostaValor;
  observacao: string;
  evidencias: string[];
}

const COLUNAS: { status: ChecklistStatus; label: string }[] = [
  { status: "sim", label: "Sim" },
  { status: "nao", label: "Não" },
];

export function ChecklistTable({
  perguntas,
  respostaPorPergunta,
  onSetStatus,
  onSetObservacao,
  onUploadEvidencia,
}: {
  perguntas: AvaliacaoPergunta[];
  respostaPorPergunta: Map<string, RespostaLocalChecklist | undefined>;
  onSetStatus: (perguntaId: string, status: ChecklistStatus) => void;
  onSetObservacao: (perguntaId: string, texto: string) => void;
  onUploadEvidencia: (perguntaId: string, file: File) => void;
}) {
  const [expandido, setExpandido] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-xs text-muted-foreground">
          <tr>
            <th className="px-3 py-2 text-left font-medium">Item</th>
            {COLUNAS.map((c) => (
              <th key={c.status} className="px-2 py-2 text-center font-medium">
                {c.label}
              </th>
            ))}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {perguntas.map((p) => {
            const resposta = respostaPorPergunta.get(p.id);
            const statusAtual = resposta?.valor && "status" in resposta.valor ? resposta.valor.status : null;
            const precisaObs = p.observacao_obrigatoria_se_nao && statusAtual === "nao" && !resposta?.observacao;
            const isExpandido = expandido === p.id;

            return (
              <>
                <tr key={p.id} className={precisaObs ? "bg-amber-50" : undefined}>
                  <td className="px-3 py-2">
                    <span>{p.enunciado}</span>
                    {p.item_critico ? (
                      <Badge variant="destructive" className="ml-2 align-middle text-[10px]">
                        Crítico
                      </Badge>
                    ) : null}
                  </td>
                  {COLUNAS.map((c) => (
                    <td key={c.status} className="px-2 py-2 text-center">
                      <button
                        type="button"
                        onClick={() => onSetStatus(p.id, c.status)}
                        className={`inline-flex size-7 items-center justify-center rounded border text-xs font-medium transition-colors ${
                          statusAtual === c.status
                            ? c.status === "nao"
                              ? "border-destructive bg-destructive text-destructive-foreground"
                              : "border-primary bg-primary text-primary-foreground"
                            : "border-input bg-background hover:bg-muted"
                        }`}
                        aria-label={c.label}
                      >
                        {statusAtual === c.status ? "✓" : ""}
                      </button>
                    </td>
                  ))}
                  <td className="px-1 text-center">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setExpandido(isExpandido ? null : p.id)}
                    >
                      {precisaObs ? (
                        <MessageSquare className="size-3.5 text-amber-600" />
                      ) : isExpandido ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                    </Button>
                  </td>
                </tr>
                {isExpandido ? (
                  <tr key={`${p.id}-detalhe`}>
                    <td colSpan={COLUNAS.length + 2} className="bg-muted/30 px-3 py-3">
                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1">
                          <label className="text-xs text-muted-foreground">
                            Observação{p.observacao_obrigatoria_se_nao ? " (obrigatória se resposta negativa)" : ""}
                          </label>
                          <Textarea
                            value={resposta?.observacao ?? ""}
                            onChange={(e) => onSetObservacao(p.id, e.target.value)}
                            className="bg-background"
                          />
                        </div>
                        <div className="flex flex-col gap-1">
                          <label className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Camera className="size-3.5" /> Evidência
                            {p.evidencia_obrigatoria ? " (obrigatória)" : ""}
                          </label>
                          <Input
                            type="file"
                            accept="image/*"
                            capture="environment"
                            className="h-10 bg-background"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) onUploadEvidencia(p.id, file);
                            }}
                          />
                          {resposta?.evidencias.length ? (
                            <p className="text-xs text-muted-foreground">
                              {resposta.evidencias.length} evidência(s) anexada(s)
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
