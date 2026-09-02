"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, ImagePlus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { opcoesGatilho, podeSerPai } from "@/lib/conditional";
import type { PerguntaTipo } from "@/lib/types";
import { PERGUNTA_TIPO_LABELS, TIPOS_PERGUNTA_DISPONIVEIS } from "@/lib/types";
import type { BuilderPergunta } from "@/app/(app)/avaliacoes/actions";

const TIPO_AJUDA: Partial<Record<PerguntaTipo, string>> = {
  multiplas_respostas: "Marcação em quadrado — pode haver mais de uma alternativa correta.",
  multipla_escolha: "Marcação em círculo — só uma alternativa pode ser a correta.",
};

export function PerguntaFormDialog({
  open,
  pergunta,
  isNew,
  todasPerguntas,
  onOpenChange,
  onSave,
}: {
  open: boolean;
  pergunta: BuilderPergunta | null;
  isNew: boolean;
  todasPerguntas: BuilderPergunta[];
  onOpenChange: (open: boolean) => void;
  onSave: (pergunta: BuilderPergunta) => void;
}) {
  const [draft, setDraft] = useState<BuilderPergunta | null>(pergunta);

  useEffect(() => {
    if (open) setDraft(pergunta);
  }, [open, pergunta]);

  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [imagemUrlCache, setImagemUrlCache] = useState<{ path: string; url: string } | null>(null);

  const imagemPath = draft?.config.imagem_path;

  useEffect(() => {
    if (!imagemPath) return;
    let cancelado = false;
    const supabase = createClient();
    supabase.storage
      .from("evidencias")
      .createSignedUrl(imagemPath, 300)
      .then(({ data }) => {
        if (!cancelado && data) setImagemUrlCache({ path: imagemPath, url: data.signedUrl });
      });
    return () => {
      cancelado = true;
    };
  }, [imagemPath]);

  if (!draft) return null;

  function update(partial: Partial<BuilderPergunta>) {
    setDraft((d) => (d ? { ...d, ...partial } : d));
  }

  function updateAlternativa(id: string, partial: Partial<BuilderPergunta["alternativas"][number]>) {
    update({
      alternativas: draft!.alternativas.map((a) => (a.id === id ? { ...a, ...partial } : a)),
    });
  }

  function removeAlternativa(id: string) {
    update({ alternativas: draft!.alternativas.filter((a) => a.id !== id) });
  }

  function addAlternativa() {
    update({
      alternativas: [
        ...draft!.alternativas,
        { id: crypto.randomUUID(), pergunta_id: draft!.id, texto: "", correta: false, ordem: draft!.alternativas.length },
      ],
    });
  }

  const imagemUrl = imagemUrlCache && imagemUrlCache.path === imagemPath ? imagemUrlCache.url : null;

  async function uploadImagem(file: File) {
    setEnviandoImagem(true);
    const supabase = createClient();
    const path = `perguntas/${draft!.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file);
    setEnviandoImagem(false);
    if (error) return;
    update({ config: { ...draft!.config, imagem_path: path } });
  }

  const paisPossiveis = todasPerguntas.filter((p) => p.id !== draft.id && podeSerPai(p.tipo));
  const paiSelecionado = todasPerguntas.find((p) => p.id === draft.config.condicional_pergunta_id);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isNew ? "Nova questão" : "Editar questão"}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label>Tipo de resposta</Label>
            <Select value={draft.tipo} onValueChange={(v) => update({ tipo: v as PerguntaTipo, config: {} })}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPOS_PERGUNTA_DISPONIVEIS.map((value) => (
                  <SelectItem key={value} value={value}>
                    {PERGUNTA_TIPO_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {TIPO_AJUDA[draft.tipo] ? (
              <p className="text-xs text-muted-foreground">{TIPO_AJUDA[draft.tipo]}</p>
            ) : null}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Enunciado</Label>
            <Textarea value={draft.enunciado} onChange={(e) => update({ enunciado: e.target.value })} rows={3} />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Imagem (opcional)</Label>
            {imagemUrl ? (
              <div className="relative w-fit">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={imagemUrl} alt="" className="h-28 rounded border object-contain" />
                <Button
                  type="button"
                  size="icon"
                  variant="secondary"
                  className="absolute -right-2 -top-2 size-6"
                  onClick={() => update({ config: { ...draft.config, imagem_path: undefined } })}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            ) : (
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-xs text-muted-foreground hover:bg-muted/50">
                <ImagePlus className="size-4" />
                {enviandoImagem ? "Enviando..." : "Adicionar imagem"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadImagem(file);
                  }}
                />
              </label>
            )}
          </div>

          <PerguntaConfigFields
            pergunta={draft}
            onChange={update}
            onAddAlternativa={addAlternativa}
            updateAlternativa={updateAlternativa}
            removeAlternativa={removeAlternativa}
          />

          {paisPossiveis.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">Pergunta condicional (mostrar somente se...)</Label>
                <Select
                  value={draft.config.condicional_pergunta_id ?? "none"}
                  onValueChange={(v) =>
                    update({
                      config: {
                        ...draft.config,
                        condicional_pergunta_id: !v || v === "none" ? undefined : v,
                        condicional_valor: undefined,
                      },
                    })
                  }
                >
                  <SelectTrigger className="h-9 w-64">
                    <SelectValue placeholder="Sempre exibir" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sempre exibir</SelectItem>
                    {paisPossiveis.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.enunciado.slice(0, 40) || "(sem enunciado)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {paiSelecionado ? (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">for igual a</Label>
                  <Select
                    value={draft.config.condicional_valor ?? ""}
                    onValueChange={(v) => update({ config: { ...draft.config, condicional_valor: v ?? undefined } })}
                  >
                    <SelectTrigger className="h-9 w-40">
                      <SelectValue placeholder="valor" />
                    </SelectTrigger>
                    <SelectContent>
                      {opcoesGatilho(paiSelecionado.tipo).map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}
            </div>
          ) : null}

          <Button className="h-11" onClick={() => onSave(draft)}>
            Salvar questão
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PerguntaConfigFields({
  pergunta,
  onChange,
  onAddAlternativa,
  updateAlternativa,
  removeAlternativa,
}: {
  pergunta: BuilderPergunta;
  onChange: (partial: Partial<BuilderPergunta>) => void;
  onAddAlternativa: () => void;
  updateAlternativa: (id: string, partial: Partial<BuilderPergunta["alternativas"][number]>) => void;
  removeAlternativa: (id: string) => void;
}) {
  switch (pergunta.tipo) {
    case "multipla_escolha":
      return (
        <div className="flex flex-col gap-2">
          <Label>Alternativas</Label>
          <RadioGroup
            value={pergunta.alternativas.find((a) => a.correta)?.id ?? ""}
            onValueChange={(v) =>
              onChange({
                alternativas: pergunta.alternativas.map((a) => ({ ...a, correta: a.id === v })),
              })
            }
            className="flex flex-col gap-2"
          >
            {pergunta.alternativas.map((alt) => (
              <div key={alt.id} className="flex items-center gap-2">
                <RadioGroupItem value={alt.id} />
                <Input
                  className="h-9 flex-1"
                  value={alt.texto}
                  onChange={(e) => updateAlternativa(alt.id, { texto: e.target.value })}
                  placeholder="Texto da alternativa"
                />
                <Button variant="ghost" size="icon" type="button" onClick={() => removeAlternativa(alt.id)}>
                  <Trash2 className="size-4" />
                </Button>
              </div>
            ))}
          </RadioGroup>
          <Button variant="outline" size="sm" type="button" onClick={onAddAlternativa} className="self-start">
            <Plus className="size-3.5" /> Alternativa
          </Button>
        </div>
      );

    case "multiplas_respostas":
      return (
        <div className="flex flex-col gap-2">
          <Label>Alternativas</Label>
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={Boolean(pergunta.config.pontuacao_parcial)}
              onCheckedChange={(v) => onChange({ config: { ...pergunta.config, pontuacao_parcial: v } })}
            />
            Permitir pontuação parcial
          </label>
          {pergunta.alternativas.map((alt) => (
            <div key={alt.id} className="flex items-center gap-2">
              <Checkbox
                checked={alt.correta}
                onCheckedChange={(v) => updateAlternativa(alt.id, { correta: Boolean(v) })}
              />
              <Input
                className="h-9 flex-1"
                value={alt.texto}
                onChange={(e) => updateAlternativa(alt.id, { texto: e.target.value })}
                placeholder="Texto da alternativa"
              />
              <Button variant="ghost" size="icon" type="button" onClick={() => removeAlternativa(alt.id)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" type="button" onClick={onAddAlternativa} className="self-start">
            <Plus className="size-3.5" /> Alternativa
          </Button>
        </div>
      );

    case "verdadeiro_falso":
    case "sim_nao":
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Gabarito (opcional — deixe em branco para correção manual)</Label>
          <Select
            value={
              pergunta.config.resposta_correta === undefined
                ? "manual"
                : String(pergunta.config.resposta_correta)
            }
            onValueChange={(v) =>
              onChange({
                config: {
                  ...pergunta.config,
                  resposta_correta: v === "manual" ? undefined : v === "true",
                },
              })
            }
          >
            <SelectTrigger className="h-9 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Correção manual</SelectItem>
              <SelectItem value="true">{pergunta.tipo === "sim_nao" ? "Sim" : "Verdadeiro"}</SelectItem>
              <SelectItem value="false">{pergunta.tipo === "sim_nao" ? "Não" : "Falso"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    case "aberta_curta":
    case "aberta_longa":
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Resposta esperada / critérios de avaliação</Label>
          <Textarea
            value={pergunta.config.criterios_esperados ?? ""}
            onChange={(e) => onChange({ config: { ...pergunta.config, criterios_esperados: e.target.value } })}
          />
        </div>
      );

    default:
      return null;
  }
}
