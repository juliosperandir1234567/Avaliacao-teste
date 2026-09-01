"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PerguntaEditor } from "@/components/pergunta-editor";
import { BancoQuestoesDialog } from "@/components/banco-questoes-dialog";
import type { AvaliacaoTipo, EquipamentoTipo } from "@/lib/types";
import {
  saveAvaliacaoBuilder,
  deleteAvaliacao,
  type BuilderPergunta,
  type BuilderSecao,
  type BuilderState,
} from "@/app/(app)/avaliacoes/actions";

const TIPO_LABELS: Record<AvaliacaoTipo, string> = {
  teorica: "Teórica",
  pratica: "Prática",
  mista: "Mista",
  checklist: "Checklist",
  tecnica: "Técnica",
  comportamental: "Comportamental",
  competencias: "Avaliação por competências",
};

function novaPergunta(ordem: number): BuilderPergunta {
  return {
    id: crypto.randomUUID(),
    competencia_id: null,
    equipamento_tipo_id: null,
    tipo: "checklist",
    enunciado: "",
    peso: 1,
    ordem,
    item_critico: false,
    criticidade_consequencia: null,
    config: {},
    evidencia_obrigatoria: false,
    observacao_obrigatoria_se_nao: false,
    alternativas: [],
  };
}

function novaSecao(ordem: number): BuilderSecao {
  return {
    id: crypto.randomUUID(),
    avaliacao_id: "",
    nome: "",
    ordem,
    peso: 0,
    perguntas: [],
  };
}

export function AvaliacaoBuilder({
  avaliacaoId,
  initial,
  equipamentos,
  editavel,
}: {
  avaliacaoId: string;
  initial: BuilderState;
  equipamentos: EquipamentoTipo[];
  editavel: boolean;
}) {
  const router = useRouter();
  const [state, setState] = useState<BuilderState>(initial);
  const [pending, startTransition] = useTransition();

  function save(publicar: boolean) {
    startTransition(async () => {
      const result = await saveAvaliacaoBuilder(avaliacaoId, state, publicar);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(publicar ? "Avaliação publicada" : "Rascunho salvo");
      if (publicar) router.push("/avaliacoes");
      else router.refresh();
    });
  }

  const somaPesoSecoes = state.secoes.reduce((acc, s) => acc + Number(s.peso || 0), 0);

  return (
    <div className="flex flex-col gap-4 pb-24">
      {!editavel ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          Esta avaliação está publicada e não pode mais ser editada diretamente. Use “Duplicar” no
          banco de avaliações para criar uma nova versão.
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Avaliação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              disabled={!editavel}
              className="h-10"
              value={state.avaliacao.nome}
              onChange={(e) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, nome: e.target.value } }))}
            />
          </Field>
          <Field label="Função">
            <Input
              disabled={!editavel}
              className="h-10"
              value={state.avaliacao.funcao}
              onChange={(e) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, funcao: e.target.value } }))}
            />
          </Field>
          <Field label="Equipamento">
            <Select
              disabled={!editavel}
              value={state.avaliacao.equipamento_tipo_id ?? ""}
              onValueChange={(v) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, equipamento_tipo_id: v || null } }))}
            >
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
          </Field>
          <Field label="Tipo">
            <Select
              disabled={!editavel}
              value={state.avaliacao.tipo}
              onValueChange={(v) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, tipo: v as AvaliacaoTipo } }))}
            >
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Nota mínima (0 a 10)">
            <Input
              disabled={!editavel}
              type="number"
              min={0}
              max={10}
              step={0.1}
              className="h-10"
              value={state.avaliacao.nota_minima}
              onChange={(e) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, nota_minima: Number(e.target.value) } }))}
            />
          </Field>
          <Field label="Descrição" full>
            <Textarea
              disabled={!editavel}
              value={state.avaliacao.descricao ?? ""}
              onChange={(e) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, descricao: e.target.value } }))}
            />
          </Field>
          <div className="col-span-full flex flex-wrap gap-4 border-t pt-3">
            <SwitchField
              label="Possui itens críticos"
              checked={state.avaliacao.possui_itens_criticos}
              disabled={!editavel}
              onChange={(v) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, possui_itens_criticos: v } }))}
            />
            <SwitchField
              label="Permite nova tentativa"
              checked={state.avaliacao.permite_nova_tentativa}
              disabled={!editavel}
              onChange={(v) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, permite_nova_tentativa: v } }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Competências</CardTitle>
          {editavel ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() =>
                setState((s) => ({
                  ...s,
                  competencias: [...s.competencias, { id: crypto.randomUUID(), avaliacao_id: avaliacaoId, nome: "", nota_minima: null }],
                }))
              }
            >
              <Plus className="size-3.5" /> Competência
            </Button>
          ) : null}
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {state.competencias.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma competência cadastrada.</p>
          ) : (
            state.competencias.map((c) => (
              <div key={c.id} className="flex items-center gap-2">
                <Input
                  disabled={!editavel}
                  className="h-9 flex-1"
                  placeholder="Nome da competência (ex: Segurança)"
                  value={c.nome}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      competencias: s.competencias.map((x) => (x.id === c.id ? { ...x, nome: e.target.value } : x)),
                    }))
                  }
                />
                <Input
                  disabled={!editavel}
                  type="number"
                  min={0}
                  max={10}
                  step={0.1}
                  placeholder="Nota mín."
                  className="h-9 w-28"
                  value={c.nota_minima ?? ""}
                  onChange={(e) =>
                    setState((s) => ({
                      ...s,
                      competencias: s.competencias.map((x) =>
                        x.id === c.id ? { ...x, nota_minima: e.target.value === "" ? null : Number(e.target.value) } : x
                      ),
                    }))
                  }
                />
                {editavel ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    onClick={() => setState((s) => ({ ...s, competencias: s.competencias.filter((x) => x.id !== c.id) }))}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Seções {state.secoes.length > 0 ? `— soma de pesos: ${somaPesoSecoes}%` : ""}
          </CardTitle>
          {editavel ? (
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => setState((s) => ({ ...s, secoes: [...s.secoes, novaSecao(s.secoes.length)] }))}
            >
              <Plus className="size-3.5" /> Seção
            </Button>
          ) : null}
        </CardHeader>
      </Card>

      {state.secoes.map((secao, secaoIdx) => (
        <Card key={secao.id}>
          <CardHeader className="flex flex-row items-center gap-2">
            <Input
              disabled={!editavel}
              className="h-9 flex-1 font-medium"
              placeholder={`Seção ${secaoIdx + 1}`}
              value={secao.nome}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  secoes: s.secoes.map((x) => (x.id === secao.id ? { ...x, nome: e.target.value } : x)),
                }))
              }
            />
            <Input
              disabled={!editavel}
              type="number"
              className="h-9 w-24"
              placeholder="Peso %"
              value={secao.peso}
              onChange={(e) =>
                setState((s) => ({
                  ...s,
                  secoes: s.secoes.map((x) => (x.id === secao.id ? { ...x, peso: Number(e.target.value) } : x)),
                }))
              }
            />
            {editavel ? (
              <Button
                variant="ghost"
                size="icon"
                type="button"
                onClick={() => setState((s) => ({ ...s, secoes: s.secoes.filter((x) => x.id !== secao.id) }))}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {secao.perguntas.map((pergunta) => (
              <PerguntaEditor
                key={pergunta.id}
                pergunta={pergunta}
                competencias={state.competencias}
                equipamentos={equipamentos}
                todasPerguntas={state.secoes.flatMap((s) => s.perguntas)}
                onChange={(novaPergunta) =>
                  setState((s) => ({
                    ...s,
                    secoes: s.secoes.map((sec) =>
                      sec.id === secao.id
                        ? { ...sec, perguntas: sec.perguntas.map((p) => (p.id === novaPergunta.id ? novaPergunta : p)) }
                        : sec
                    ),
                  }))
                }
                onRemove={() =>
                  setState((s) => ({
                    ...s,
                    secoes: s.secoes.map((sec) =>
                      sec.id === secao.id ? { ...sec, perguntas: sec.perguntas.filter((p) => p.id !== pergunta.id) } : sec
                    ),
                  }))
                }
              />
            ))}
            {editavel ? (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={() =>
                    setState((s) => ({
                      ...s,
                      secoes: s.secoes.map((sec) =>
                        sec.id === secao.id
                          ? { ...sec, perguntas: [...sec.perguntas, novaPergunta(sec.perguntas.length)] }
                          : sec
                      ),
                    }))
                  }
                >
                  <Plus className="size-3.5" /> Pergunta
                </Button>
                <BancoQuestoesDialog
                  ordemInicial={secao.perguntas.length}
                  onImportar={(pergunta) =>
                    setState((s) => ({
                      ...s,
                      secoes: s.secoes.map((sec) =>
                        sec.id === secao.id ? { ...sec, perguntas: [...sec.perguntas, pergunta] } : sec
                      ),
                    }))
                  }
                />
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}

      {editavel ? (
        <div className="fixed inset-x-0 bottom-16 z-30 flex justify-center gap-2 border-t bg-background p-3 md:bottom-0 md:left-56">
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={pending}
            onClick={() => {
              if (!confirm("Excluir esta avaliação? Essa ação não pode ser desfeita.")) return;
              startTransition(async () => {
                const result = await deleteAvaliacao(avaliacaoId);
                if (result?.error) {
                  toast.error(result.error);
                  return;
                }
                toast.success("Avaliação excluída");
                router.push("/avaliacoes");
              });
            }}
          >
            Excluir
          </Button>
          <Button variant="outline" disabled={pending} onClick={() => save(false)}>
            Salvar Rascunho
          </Button>
          <Button disabled={pending} onClick={() => save(true)}>
            Publicar
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function Field({ label, children, full }: { label: string; children: React.ReactNode; full?: boolean }) {
  return (
    <div className={`flex flex-col gap-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function SwitchField({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
      {label}
    </label>
  );
}
