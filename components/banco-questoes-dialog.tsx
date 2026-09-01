"use client";

import { useState, useTransition } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { buscarBancoQuestoes, type BancoQuestaoResultado } from "@/app/(app)/avaliacoes/actions";
import { PERGUNTA_TIPO_LABELS, type PerguntaTipo } from "@/lib/types";
import type { BuilderPergunta } from "@/app/(app)/avaliacoes/actions";

export function BancoQuestoesDialog({
  ordemInicial,
  onImportar,
}: {
  ordemInicial: number;
  onImportar: (pergunta: BuilderPergunta) => void;
}) {
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState("");
  const [tipo, setTipo] = useState("");
  const [resultados, setResultados] = useState<BancoQuestaoResultado[]>([]);
  const [pending, startTransition] = useTransition();

  function buscar() {
    startTransition(async () => {
      const r = await buscarBancoQuestoes({ texto: texto || undefined, tipo: tipo || undefined });
      setResultados(r);
    });
  }

  function importar(q: BancoQuestaoResultado, index: number) {
    const novaPerguntaId = crypto.randomUUID();
    onImportar({
      id: novaPerguntaId,
      competencia_id: null,
      equipamento_tipo_id: q.equipamento_tipo_id,
      tipo: q.tipo as PerguntaTipo,
      enunciado: q.enunciado,
      peso: q.peso,
      ordem: ordemInicial + index,
      item_critico: q.item_critico,
      criticidade_consequencia: q.item_critico ? "alerta" : null,
      config: q.config,
      evidencia_obrigatoria: false,
      observacao_obrigatoria_se_nao: false,
      alternativas: q.alternativas.map((a) => ({
        id: crypto.randomUUID(),
        pergunta_id: novaPerguntaId,
        texto: a.texto,
        correta: a.correta,
        ordem: a.ordem,
      })),
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" variant="outline" size="sm" />}>
        Importar do Banco de Questões
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Banco de Questões</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <Input
              placeholder="Buscar por texto da pergunta"
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && buscar()}
              className="h-9"
            />
            <Select value={tipo || "todos"} onValueChange={(v) => setTipo(!v || v === "todos" ? "" : v)}>
              <SelectTrigger className="h-9 w-44">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os tipos</SelectItem>
                {Object.entries(PERGUNTA_TIPO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" onClick={buscar} disabled={pending}>
              Buscar
            </Button>
          </div>

          <div className="flex max-h-80 flex-col divide-y overflow-y-auto rounded-md border">
            {resultados.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                {pending ? "Buscando..." : "Nenhum resultado. Faça uma busca acima."}
              </p>
            ) : (
              resultados.map((q, i) => (
                <div key={q.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                  <div className="min-w-0">
                    <p className="truncate">{q.enunciado}</p>
                    <p className="text-xs text-muted-foreground">
                      {PERGUNTA_TIPO_LABELS[q.tipo as PerguntaTipo]} · {q.avaliacao_nome} ({q.avaliacao_funcao})
                      {q.item_critico ? (
                        <Badge variant="destructive" className="ml-2">
                          Crítico
                        </Badge>
                      ) : null}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      importar(q, i);
                      setOpen(false);
                    }}
                  >
                    Adicionar
                  </Button>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
