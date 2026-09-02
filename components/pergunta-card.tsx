"use client";

import { ArrowUp, ArrowDown, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PERGUNTA_TIPO_LABELS } from "@/lib/types";
import type { BuilderPergunta } from "@/app/(app)/avaliacoes/actions";

function letra(i: number) {
  return String.fromCharCode(65 + i);
}

export function PerguntaCard({
  pergunta,
  numero,
  editavel,
  podeSubir,
  podeDescer,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: {
  pergunta: BuilderPergunta;
  numero: number;
  editavel: boolean;
  podeSubir: boolean;
  podeDescer: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const gabaritoBool =
    pergunta.config.resposta_correta === undefined
      ? null
      : pergunta.config.resposta_correta
        ? pergunta.tipo === "sim_nao"
          ? "Sim"
          : "Verdadeiro"
        : pergunta.tipo === "sim_nao"
          ? "Não"
          : "Falso";

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border p-4 ${
        pergunta.config.precisa_revisao ? "border-amber-400 bg-amber-50/50" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="w-fit rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {PERGUNTA_TIPO_LABELS[pergunta.tipo]}
        </span>
        {editavel ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon-sm" type="button" disabled={!podeSubir} onClick={onMoveUp}>
              <ArrowUp className="size-3.5" />
            </Button>
            <Button variant="ghost" size="icon-sm" type="button" disabled={!podeDescer} onClick={onMoveDown}>
              <ArrowDown className="size-3.5" />
            </Button>
          </div>
        ) : null}
      </div>

      <p className="font-medium">
        {numero}. {pergunta.enunciado || "(sem enunciado)"}
      </p>

      {(pergunta.tipo === "multipla_escolha" || pergunta.tipo === "multiplas_respostas") &&
      pergunta.alternativas.length > 0 ? (
        <div className="flex flex-col gap-0.5 pl-1 text-sm">
          {pergunta.alternativas.map((alt, i) =>
            alt.correta ? (
              <p key={alt.id} className="font-semibold text-green-700">
                {letra(i)}) {alt.texto || "(vazio)"} ✓
              </p>
            ) : (
              <p key={alt.id} className="text-muted-foreground">
                {letra(i)}) {alt.texto || "(vazio)"}
              </p>
            )
          )}
        </div>
      ) : null}

      {(pergunta.tipo === "sim_nao" || pergunta.tipo === "verdadeiro_falso") ? (
        <p className="pl-1 text-sm">
          {gabaritoBool ? (
            <span className="font-semibold text-green-700">Gabarito: {gabaritoBool} ✓</span>
          ) : (
            <span className="text-muted-foreground">Correção manual</span>
          )}
        </p>
      ) : null}

      {editavel ? (
        <div className="flex gap-2 pt-1">
          <Button variant="outline" size="sm" type="button" onClick={onEdit}>
            <Pencil className="size-3.5" /> Editar
          </Button>
          <Button variant="destructive" size="sm" type="button" onClick={onDelete}>
            <Trash2 className="size-3.5" /> Excluir
          </Button>
        </div>
      ) : null}
    </div>
  );
}
