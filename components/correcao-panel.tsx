"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QuestionInput } from "@/components/question-input";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { corrigirResposta } from "@/app/(app)/aplicacoes/actions";
import { precisaCorrecaoManual } from "@/lib/scoring";
import { ParecerFinalForm } from "@/components/parecer-final-form";
import { PERGUNTA_TIPO_LABELS } from "@/lib/types";
import type {
  AvaliacaoAlternativa,
  AvaliacaoPergunta,
  AvaliacaoSecao,
  Parecer,
  Resposta,
  RespostaValor,
} from "@/lib/types";

interface AuditRow {
  id: string;
  acao: string;
  usuario_id: string | null;
  antes: unknown;
  depois: unknown;
  motivo: string | null;
  created_at: string;
  profiles?: { nome: string } | null;
}

export function CorrecaoPanel({
  aplicacaoId,
  secoes,
  perguntas,
  alternativas,
  respostas,
  auditLog,
  parecerFinal,
  parecerJustificativa,
}: {
  aplicacaoId: string;
  secoes: AvaliacaoSecao[];
  perguntas: AvaliacaoPergunta[];
  alternativas: AvaliacaoAlternativa[];
  respostas: Resposta[];
  auditLog: AuditRow[];
  parecerFinal: Parecer;
  parecerJustificativa: string;
}) {
  const [aberto, setAberto] = useState(false);

  return (
    <Card className="border-amber-300">
      <CardHeader>
        <button
          type="button"
          className="flex w-full items-center justify-between text-left"
          onClick={() => setAberto((v) => !v)}
        >
          <CardTitle className="text-base">Correção (admin)</CardTitle>
          {aberto ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </button>
      </CardHeader>
      {aberto ? (
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-muted-foreground">
            Alterar uma resposta desta avaliação já finalizada exige um motivo e fica registrado na
            trilha de auditoria abaixo. A nota geral e o parecer sugerido são recalculados automaticamente.
          </p>

          <div className="rounded-md border p-3">
            <p className="mb-2 text-sm font-medium">Parecer final</p>
            <ParecerFinalForm
              aplicacaoId={aplicacaoId}
              parecerFinal={parecerFinal}
              justificativa={parecerJustificativa}
              editavel
            />
          </div>

          <div className="flex flex-col divide-y">
            {secoes
              .sort((a, b) => a.ordem - b.ordem)
              .map((secao) => (
                <div key={secao.id} className="py-2">
                  <p className="mb-2 text-sm font-medium">{secao.nome}</p>
                  {perguntas
                    .filter((p) => p.secao_id === secao.id)
                    .map((p) => (
                      <PerguntaCorrecao
                        key={p.id}
                        aplicacaoId={aplicacaoId}
                        pergunta={p}
                        alternativas={alternativas.filter((a) => a.pergunta_id === p.id)}
                        resposta={respostas.find((r) => r.pergunta_id === p.id)}
                      />
                    ))}
                </div>
              ))}
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">Trilha de auditoria</p>
            {auditLog.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma correção registrada.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {auditLog.map((entry) => (
                  <div key={entry.id} className="rounded-md border p-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">
                        {entry.profiles?.nome ?? "Usuário"} · {entry.acao}
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(entry.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    {entry.motivo ? <p className="mt-1 text-muted-foreground">Motivo: {entry.motivo}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      ) : null}
    </Card>
  );
}

function valorPadrao(tipo: AvaliacaoPergunta["tipo"]): RespostaValor {
  switch (tipo) {
    case "multipla_escolha":
      return { alternativa_id: null };
    case "multiplas_respostas":
      return { alternativa_ids: [] };
    case "verdadeiro_falso":
    case "sim_nao":
      return { valor_bool: null };
    case "numerica":
      return { valor_numerico: null };
    case "checklist":
      return { status: "nao_avaliado" };
    case "aberta_curta":
    case "aberta_longa":
      return { texto: "" };
  }
}

function PerguntaCorrecao({
  aplicacaoId,
  pergunta,
  alternativas,
  resposta,
}: {
  aplicacaoId: string;
  pergunta: AvaliacaoPergunta;
  alternativas: AvaliacaoAlternativa[];
  resposta?: Resposta;
}) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState<RespostaValor | undefined>(
    resposta?.resposta ?? valorPadrao(pergunta.tipo)
  );
  const [pontuacaoManual, setPontuacaoManual] = useState<number | null>(resposta?.pontuacao ?? null);
  const [motivo, setMotivo] = useState("");
  const [pending, startTransition] = useTransition();

  if (!editando) {
    return (
      <div className="flex items-center justify-between py-1 text-sm">
        <div>
          <p>{pergunta.enunciado}</p>
          <p className="text-xs text-muted-foreground">
            {PERGUNTA_TIPO_LABELS[pergunta.tipo]} · Nota: {resposta?.pontuacao?.toFixed(1) ?? "-"}
          </p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => setEditando(true)}>
          Corrigir
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3">
      <p className="text-sm font-medium">{pergunta.enunciado}</p>
      {valor ? (
        <QuestionInput pergunta={pergunta} alternativas={alternativas} value={valor} onChange={setValor} />
      ) : null}
      {precisaCorrecaoManual(pergunta) ? (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Nota manual (0 a 10)</Label>
          <Input
            type="number"
            min={0}
            max={10}
            step={0.5}
            className="h-9 w-28"
            value={pontuacaoManual ?? ""}
            onChange={(e) => setPontuacaoManual(e.target.value === "" ? null : Number(e.target.value))}
          />
        </div>
      ) : null}
      <Textarea
        placeholder="Motivo da correção (obrigatório)"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
      />
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={() => setEditando(false)} disabled={pending}>
          Cancelar
        </Button>
        <Button
          size="sm"
          disabled={pending || !motivo.trim() || !valor}
          onClick={() =>
            startTransition(async () => {
              const result = await corrigirResposta(aplicacaoId, pergunta.id, valor!, motivo, pontuacaoManual);
              if (result.error) {
                toast.error(result.error);
                return;
              }
              toast.success("Resposta corrigida");
              setEditando(false);
            })
          }
        >
          Salvar Correção
        </Button>
      </div>
    </div>
  );
}
