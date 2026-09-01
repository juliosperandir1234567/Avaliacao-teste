"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { parseWordText, type ParsedAvaliacao } from "@/lib/word-import-parser";
import { criarAvaliacaoDeImportacaoWord } from "../actions";
import { PERGUNTA_TIPO_LABELS } from "@/lib/types";
import type { EquipamentoTipo } from "@/lib/types";

export function ImportarWordForm({ equipamentos }: { equipamentos: EquipamentoTipo[] }) {
  const [fileName, setFileName] = useState("");
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedAvaliacao | null>(null);
  const [nome, setNome] = useState("");
  const [funcao, setFuncao] = useState("");
  const [equipamentoTipoId, setEquipamentoTipoId] = useState("");
  const [pending, startTransition] = useTransition();

  async function handleFile(file: File) {
    setFileName(file.name);
    setParsing(true);
    setParsed(null);
    try {
      const mammoth = (await import("mammoth")).default;
      const buffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer: buffer });
      const parsedResult = parseWordText(result.value);
      if (parsedResult.perguntas.length === 0 && parsedResult.checklist.length === 0) {
        toast.error("Não encontrei perguntas ou itens de checklist nesse arquivo.");
        return;
      }
      setParsed(parsedResult);
      if (!nome) setNome(file.name.replace(/\.docx?$/i, ""));
    } catch (e) {
      toast.error("Falha ao ler o arquivo Word: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setParsing(false);
    }
  }

  function importar() {
    if (!parsed) return;
    startTransition(async () => {
      const result = await criarAvaliacaoDeImportacaoWord(
        nome,
        funcao,
        equipamentoTipoId,
        parsed.perguntas.map((p) => ({
          enunciado: p.enunciado,
          tipo: p.tipo,
          alternativas: p.alternativas,
          precisaRevisao: p.precisaRevisao,
        })),
        parsed.checklist.map((p) => ({
          enunciado: p.enunciado,
          tipo: p.tipo,
          alternativas: p.alternativas,
          precisaRevisao: p.precisaRevisao,
        }))
      );
      if (result?.error) toast.error(result.error);
    });
  }

  const totalItens = (parsed?.perguntas.length ?? 0) + (parsed?.checklist.length ?? 0);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Importar avaliação do Word</CardTitle>
          <CardDescription>
            Envie o arquivo .docx da prova. O sistema tenta reconhecer as perguntas e o checklist
            automaticamente — sempre revise antes de publicar.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-4 py-3 text-sm hover:bg-muted/50">
            {parsing ? "Lendo arquivo..." : fileName || "Selecionar arquivo .docx"}
            <input
              type="file"
              accept=".docx"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>

          {parsed ? (
            <>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label>Equipamento</Label>
                  <Select value={equipamentoTipoId} onValueChange={(v) => setEquipamentoTipoId(v ?? "")}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Selecione o equipamento" />
                    </SelectTrigger>
                    <SelectContent>
                      {equipamentos.map((eq) => (
                        <SelectItem key={eq.id} value={eq.id}>
                          {eq.familia} — {eq.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label>Nome da avaliação</Label>
                  <Input className="h-10" value={nome} onChange={(e) => setNome(e.target.value)} />
                </div>
                <div className="flex flex-col gap-1.5 sm:col-span-2">
                  <Label>Função avaliada</Label>
                  <Input
                    className="h-10"
                    value={funcao}
                    onChange={(e) => setFuncao(e.target.value)}
                    placeholder="Ex: Operador de Colhedora"
                  />
                </div>
              </div>

              <div className="rounded-md border p-3 text-sm">
                <p className="font-medium">{totalItens} item(ns) reconhecidos</p>
                <p className="text-muted-foreground">
                  {parsed.perguntas.length} pergunta(s) de múltipla escolha (gabarito precisa ser
                  revisado) · {parsed.checklist.length} item(ns) de checklist
                </p>
              </div>

              <div className="flex max-h-72 flex-col gap-2 overflow-y-auto rounded-md border p-3">
                {[...parsed.perguntas, ...parsed.checklist].map((p, i) => (
                  <div key={i} className="flex flex-col gap-0.5 border-b pb-2 text-sm last:border-0">
                    <span className="font-medium">{p.enunciado}</span>
                    <span className="text-xs text-muted-foreground">
                      {PERGUNTA_TIPO_LABELS[p.tipo as keyof typeof PERGUNTA_TIPO_LABELS]}
                      {p.alternativas.length > 0 ? ` · ${p.alternativas.length} alternativa(s)` : ""}
                      {p.precisaRevisao ? " · revisar gabarito" : ""}
                    </span>
                  </div>
                ))}
              </div>

              <Button
                className="h-11"
                disabled={pending || !nome || !equipamentoTipoId}
                onClick={importar}
              >
                {pending ? "Importando..." : "Importar e abrir no construtor"}
              </Button>
            </>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
