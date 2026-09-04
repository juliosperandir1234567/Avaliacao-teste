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
import { PerguntaCard } from "@/components/pergunta-card";
import { PerguntaFormDialog } from "@/components/pergunta-form-dialog";
import { ChecklistBulkAdd } from "@/components/checklist-bulk-add";
import { CHECKLIST_ESCALA_LABELS } from "@/lib/types";
import type { AvaliacaoStatus, ChecklistEscala, EquipamentoTipo } from "@/lib/types";
import {
  saveAvaliacaoBuilder,
  deleteAvaliacao,
  type BuilderPergunta,
  type BuilderSecao,
  type BuilderState,
} from "@/app/(app)/avaliacoes/actions";

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
    escala_checklist: "sim_nao",
    perguntas: [],
  };
}

export function AvaliacaoBuilder({
  avaliacaoId,
  initial,
  equipamentos,
  statusInicial,
}: {
  avaliacaoId: string;
  initial: BuilderState;
  equipamentos: EquipamentoTipo[];
  statusInicial: AvaliacaoStatus;
}) {
  const jaPublicada = statusInicial !== "rascunho" && statusInicial !== "em_revisao";
  const router = useRouter();
  const [state, setState] = useState<BuilderState>(initial);
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<{ secaoId: string; pergunta: BuilderPergunta; isNew: boolean } | null>(
    null
  );

  const somaPontosSecoes = state.secoes.reduce((acc, s) => acc + Number(s.peso || 0), 0);

  function abrirNovaPergunta(secaoId: string) {
    setEditando({ secaoId, pergunta: novaPergunta(0), isNew: true });
  }

  function abrirEdicao(secaoId: string, pergunta: BuilderPergunta) {
    setEditando({ secaoId, pergunta, isNew: false });
  }

  function salvarPergunta(p: BuilderPergunta) {
    if (!editando) return;
    setState((s) => ({
      ...s,
      secoes: s.secoes.map((sec) => {
        if (sec.id !== editando.secaoId) return sec;
        const existe = sec.perguntas.some((x) => x.id === p.id);
        return {
          ...sec,
          perguntas: existe
            ? sec.perguntas.map((x) => (x.id === p.id ? p : x))
            : [...sec.perguntas, { ...p, ordem: sec.perguntas.length }],
        };
      }),
    }));
    setEditando(null);
  }

  function excluirPergunta(secaoId: string, perguntaId: string) {
    setState((s) => ({
      ...s,
      secoes: s.secoes.map((sec) =>
        sec.id === secaoId ? { ...sec, perguntas: sec.perguntas.filter((p) => p.id !== perguntaId) } : sec
      ),
    }));
  }

  function moverPergunta(secaoId: string, perguntaId: string, direcao: -1 | 1) {
    setState((s) => ({
      ...s,
      secoes: s.secoes.map((sec) => {
        if (sec.id !== secaoId) return sec;
        const idx = sec.perguntas.findIndex((p) => p.id === perguntaId);
        const novoIdx = idx + direcao;
        if (idx < 0 || novoIdx < 0 || novoIdx >= sec.perguntas.length) return sec;
        const perguntas = [...sec.perguntas];
        [perguntas[idx], perguntas[novoIdx]] = [perguntas[novoIdx], perguntas[idx]];
        return { ...sec, perguntas: perguntas.map((p, i) => ({ ...p, ordem: i })) };
      }),
    }));
  }

  function moverPerguntaParaSecao(secaoOrigemId: string, perguntaId: string, secaoDestinoId: string) {
    if (secaoOrigemId === secaoDestinoId) return;
    setState((s) => {
      const origem = s.secoes.find((sec) => sec.id === secaoOrigemId);
      const pergunta = origem?.perguntas.find((p) => p.id === perguntaId);
      if (!pergunta) return s;
      return {
        ...s,
        secoes: s.secoes.map((sec) => {
          if (sec.id === secaoOrigemId) {
            return {
              ...sec,
              perguntas: sec.perguntas.filter((p) => p.id !== perguntaId).map((p, i) => ({ ...p, ordem: i })),
            };
          }
          if (sec.id === secaoDestinoId) {
            return { ...sec, perguntas: [...sec.perguntas, { ...pergunta, ordem: sec.perguntas.length }] };
          }
          return sec;
        }),
      };
    });
  }

  function save(publicar: boolean) {
    startTransition(async () => {
      const result = await saveAvaliacaoBuilder(avaliacaoId, state, publicar);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      const mensagemSucesso = jaPublicada
        ? "Alterações salvas"
        : publicar
          ? "Avaliação publicada"
          : "Rascunho salvo";
      if (result?.warning) {
        toast.warning(`${mensagemSucesso}. ${result.warning}`, { duration: 12000 });
      } else {
        toast.success(mensagemSucesso);
      }
      if (jaPublicada) {
        router.refresh();
      } else if (publicar) {
        router.push("/avaliacoes");
      } else {
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4 pb-24">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dados da Avaliação</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Nome">
            <Input
              className="h-10"
              value={state.avaliacao.nome}
              onChange={(e) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, nome: e.target.value } }))}
            />
          </Field>
          <Field label="Função">
            <Input
              className="h-10"
              value={state.avaliacao.funcao}
              onChange={(e) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, funcao: e.target.value } }))}
            />
          </Field>
          <Field label="Equipamento">
            <Select
              items={equipamentos.map((eq) => ({ value: eq.id, label: `${eq.familia} — ${eq.nome}` }))}
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
          <Field label="Nota mínima (0 a 10)">
            <Input
              type="number"
              min={0}
              max={10}
              step={0.1}
              className="h-10"
              value={state.avaliacao.nota_minima}
              onChange={(e) => {
                if (e.target.value === "") return;
                const v = Number(e.target.value);
                setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, nota_minima: v } }));
              }}
            />
          </Field>
          <Field label="Descrição" full>
            <Textarea
              value={state.avaliacao.descricao ?? ""}
              onChange={(e) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, descricao: e.target.value } }))}
            />
          </Field>
          <div className="col-span-full flex flex-wrap gap-4 border-t pt-3">
            <SwitchField
              label="Permite nova tentativa"
              checked={state.avaliacao.permite_nova_tentativa}
              onChange={(v) => setState((s) => ({ ...s, avaliacao: { ...s.avaliacao, permite_nova_tentativa: v } }))}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">
            Seções {state.secoes.length > 0 ? `— soma de pontos: ${somaPontosSecoes}/10` : ""}
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            type="button"
            onClick={() => setState((s) => ({ ...s, secoes: [...s.secoes, novaSecao(s.secoes.length)] }))}
          >
            <Plus className="size-3.5" /> Seção
          </Button>
        </CardHeader>
      </Card>

      {state.secoes.map((secao, secaoIdx) => (
        <Card key={secao.id}>
          <CardHeader className="flex flex-row items-center gap-2">
            <Input
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
              type="number"
              min={0}
              max={10}
              step={0.1}
              className="h-9 w-28"
              placeholder="Pontos"
              value={secao.peso}
              onChange={(e) => {
                if (e.target.value === "") return;
                const v = Number(e.target.value);
                setState((s) => ({
                  ...s,
                  secoes: s.secoes.map((x) => (x.id === secao.id ? { ...x, peso: v } : x)),
                }));
              }}
            />
            <Button
              variant="ghost"
              size="icon"
              type="button"
              onClick={() => setState((s) => ({ ...s, secoes: s.secoes.filter((x) => x.id !== secao.id) }))}
            >
              <Trash2 className="size-4" />
            </Button>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field label="Escala do checklist (aplica-se a todas as perguntas checklist desta seção)">
              <Select
                items={CHECKLIST_ESCALA_LABELS}
                value={secao.escala_checklist}
                onValueChange={(v) =>
                  setState((s) => ({
                    ...s,
                    secoes: s.secoes.map((x) =>
                      x.id === secao.id ? { ...x, escala_checklist: v as ChecklistEscala } : x
                    ),
                  }))
                }
              >
                <SelectTrigger className="h-9 w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHECKLIST_ESCALA_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {secao.perguntas.map((pergunta, idx) => (
              <PerguntaCard
                key={pergunta.id}
                pergunta={pergunta}
                numero={idx + 1}
                editavel
                podeSubir={idx > 0}
                podeDescer={idx < secao.perguntas.length - 1}
                outrasSecoes={state.secoes
                  .map((s, i) => ({ id: s.id, nome: s.nome || `Seção ${i + 1}` }))
                  .filter((s) => s.id !== secao.id)}
                onEdit={() => abrirEdicao(secao.id, pergunta)}
                onDelete={() => excluirPergunta(secao.id, pergunta.id)}
                onMoveUp={() => moverPergunta(secao.id, pergunta.id, -1)}
                onMoveDown={() => moverPergunta(secao.id, pergunta.id, 1)}
                onMoverSecao={(destino) => moverPerguntaParaSecao(secao.id, pergunta.id, destino)}
              />
            ))}
            <Button type="button" onClick={() => abrirNovaPergunta(secao.id)} className="self-start">
              <Plus className="size-3.5" /> Nova questão
            </Button>
            <ChecklistBulkAdd
              onAdd={(itens) =>
                setState((s) => ({
                  ...s,
                  secoes: s.secoes.map((sec) =>
                    sec.id === secao.id
                      ? {
                          ...sec,
                          perguntas: [
                            ...sec.perguntas,
                            ...itens.map((enunciado, i) => ({
                              ...novaPergunta(sec.perguntas.length + i),
                              enunciado,
                            })),
                          ],
                        }
                      : sec
                  ),
                }))
              }
            />
          </CardContent>
        </Card>
      ))}

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
        {jaPublicada ? (
          <Button disabled={pending} onClick={() => save(true)}>
            {pending ? "Salvando..." : "Salvar alterações"}
          </Button>
        ) : (
          <>
            <Button variant="outline" disabled={pending} onClick={() => save(false)}>
              Salvar Rascunho
            </Button>
            <Button disabled={pending} onClick={() => save(true)}>
              Publicar
            </Button>
          </>
        )}
      </div>

      <PerguntaFormDialog
        open={editando !== null}
        pergunta={editando?.pergunta ?? null}
        isNew={editando?.isNew ?? false}
        escalaChecklist={
          (editando && state.secoes.find((s) => s.id === editando.secaoId)?.escala_checklist) || "sim_nao"
        }
        todasPerguntas={state.secoes.flatMap((s) => s.perguntas)}
        onOpenChange={(o) => {
          if (!o) setEditando(null);
        }}
        onSave={salvarPergunta}
      />
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
