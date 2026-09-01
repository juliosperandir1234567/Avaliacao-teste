"use client";

import { useEffect, useState } from "react";
import { Trash2, Plus, ImagePlus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createClient } from "@/utils/supabase/client";
import { opcoesGatilho, podeSerPai } from "@/lib/conditional";
import type {
  AvaliacaoCompetencia,
  CriticidadeConsequencia,
  EquipamentoTipo,
  PerguntaTipo,
} from "@/lib/types";
import { PERGUNTA_TIPO_LABELS, TIPOS_PERGUNTA_DISPONIVEIS } from "@/lib/types";
import type { BuilderPergunta } from "@/app/(app)/avaliacoes/actions";

const CRITICIDADE_LABELS: Record<CriticidadeConsequencia, string> = {
  alerta: "Apenas alerta",
  desconto: "Desconto na nota",
  limitar_nota: "Limitar nota (impede aprovação)",
  exigir_nova_avaliacao: "Exigir nova avaliação",
  nao_recomendar: "Não recomendar",
};

export function PerguntaEditor({
  pergunta,
  competencias,
  equipamentos,
  todasPerguntas,
  onChange,
  onRemove,
}: {
  pergunta: BuilderPergunta;
  competencias: AvaliacaoCompetencia[];
  equipamentos: EquipamentoTipo[];
  todasPerguntas: BuilderPergunta[];
  onChange: (pergunta: BuilderPergunta) => void;
  onRemove: () => void;
}) {
  function update(partial: Partial<BuilderPergunta>) {
    onChange({ ...pergunta, ...partial });
  }

  const [enviandoImagem, setEnviandoImagem] = useState(false);
  const [imagemUrlCache, setImagemUrlCache] = useState<{ path: string; url: string } | null>(null);

  const imagemPath = pergunta.config.imagem_path;

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

  const imagemUrl = imagemUrlCache && imagemUrlCache.path === imagemPath ? imagemUrlCache.url : null;

  async function uploadImagem(file: File) {
    setEnviandoImagem(true);
    const supabase = createClient();
    const path = `perguntas/${pergunta.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("evidencias").upload(path, file);
    setEnviandoImagem(false);
    if (error) return;
    update({ config: { ...pergunta.config, imagem_path: path } });
  }

  const paisPossiveis = todasPerguntas.filter((p) => p.id !== pergunta.id && podeSerPai(p.tipo));
  const paiSelecionado = todasPerguntas.find((p) => p.id === pergunta.config.condicional_pergunta_id);

  function addAlternativa() {
    update({
      alternativas: [
        ...pergunta.alternativas,
        { id: crypto.randomUUID(), pergunta_id: pergunta.id, texto: "", correta: false, ordem: pergunta.alternativas.length },
      ],
    });
  }

  return (
    <div className={`flex flex-col gap-3 rounded-md border p-3 ${pergunta.config.precisa_revisao ? "border-amber-400 bg-amber-50/50" : ""}`}>
      {pergunta.config.precisa_revisao ? (
        <span className="w-fit rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
          Revisar (importado automaticamente)
        </span>
      ) : null}
      <div className="flex items-start gap-2">
        <Textarea
          value={pergunta.enunciado}
          onChange={(e) => update({ enunciado: e.target.value })}
          placeholder="Enunciado da pergunta"
          className="flex-1"
        />
        <Button variant="ghost" size="icon" onClick={onRemove} type="button">
          <Trash2 className="size-4" />
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Tipo</Label>
          <Select
            value={pergunta.tipo}
            onValueChange={(v) => update({ tipo: v as PerguntaTipo, config: {} })}
          >
            <SelectTrigger className="h-9">
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
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Peso</Label>
          <Input
            type="number"
            min={0}
            step={0.5}
            className="h-9"
            value={pergunta.peso}
            onChange={(e) => update({ peso: Number(e.target.value) })}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Competência</Label>
          <Select
            value={pergunta.competencia_id ?? "none"}
            onValueChange={(v) => update({ competencia_id: v === "none" ? null : v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhuma</SelectItem>
              {competencias.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Equipamento</Label>
          <Select
            value={pergunta.equipamento_tipo_id ?? "none"}
            onValueChange={(v) => update({ equipamento_tipo_id: v === "none" ? null : v })}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Comum (todos)</SelectItem>
              {equipamentos.map((eq) => (
                <SelectItem key={eq.id} value={eq.id}>
                  {eq.familia} — {eq.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <PerguntaConfigFields pergunta={pergunta} onChange={update} onAddAlternativa={addAlternativa} />

      <div className="flex flex-col gap-1.5">
        <Label className="text-xs">Imagem (opcional)</Label>
        {imagemUrl ? (
          <div className="relative w-fit">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={imagemUrl} alt="" className="h-28 rounded border object-contain" />
            <Button
              type="button"
              size="icon"
              variant="secondary"
              className="absolute -right-2 -top-2 size-6"
              onClick={() => update({ config: { ...pergunta.config, imagem_path: undefined } })}
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

      {paisPossiveis.length > 0 ? (
        <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed p-2">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Pergunta condicional (mostrar somente se...)</Label>
            <Select
              value={pergunta.config.condicional_pergunta_id ?? "none"}
              onValueChange={(v) =>
                update({
                  config: {
                    ...pergunta.config,
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
                value={pergunta.config.condicional_valor ?? ""}
                onValueChange={(v) => update({ config: { ...pergunta.config, condicional_valor: v ?? undefined } })}
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

      <div className="flex flex-wrap items-center gap-4 border-t pt-2">
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={pergunta.evidencia_obrigatoria} onCheckedChange={(v) => update({ evidencia_obrigatoria: v })} />
          Evidência obrigatória
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={pergunta.observacao_obrigatoria_se_nao}
            onCheckedChange={(v) => update({ observacao_obrigatoria_se_nao: v })}
          />
          Observação obrigatória se &quot;não&quot;
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Switch
            checked={pergunta.item_critico}
            onCheckedChange={(v) =>
              update({ item_critico: v, criticidade_consequencia: v ? "alerta" : null })
            }
          />
          Item crítico
        </label>
        {pergunta.item_critico ? (
          <Select
            value={pergunta.criticidade_consequencia ?? "alerta"}
            onValueChange={(v) => update({ criticidade_consequencia: v as CriticidadeConsequencia })}
          >
            <SelectTrigger className="h-8 w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CRITICIDADE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : null}
      </div>
    </div>
  );
}

function PerguntaConfigFields({
  pergunta,
  onChange,
  onAddAlternativa,
}: {
  pergunta: BuilderPergunta;
  onChange: (partial: Partial<BuilderPergunta>) => void;
  onAddAlternativa: () => void;
}) {
  function updateAlternativa(id: string, partial: Partial<BuilderPergunta["alternativas"][number]>) {
    onChange({
      alternativas: pergunta.alternativas.map((a) => (a.id === id ? { ...a, ...partial } : a)),
    });
  }

  function removeAlternativa(id: string) {
    onChange({ alternativas: pergunta.alternativas.filter((a) => a.id !== id) });
  }

  switch (pergunta.tipo) {
    case "multipla_escolha":
    case "multiplas_respostas":
      return (
        <div className="flex flex-col gap-2">
          {pergunta.tipo === "multiplas_respostas" ? (
            <label className="flex items-center gap-2 text-sm">
              <Switch
                checked={Boolean(pergunta.config.pontuacao_parcial)}
                onCheckedChange={(v) => onChange({ config: { ...pergunta.config, pontuacao_parcial: v } })}
              />
              Permitir pontuação parcial
            </label>
          ) : null}
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

    case "numerica":
      return (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Unidade</Label>
            <Input
              className="h-9"
              value={pergunta.config.unidade ?? ""}
              onChange={(e) => onChange({ config: { ...pergunta.config, unidade: e.target.value } })}
              placeholder="ex: bar, °C"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Valor mínimo</Label>
            <Input
              type="number"
              className="h-9"
              value={pergunta.config.valor_min ?? ""}
              onChange={(e) =>
                onChange({
                  config: { ...pergunta.config, valor_min: e.target.value === "" ? undefined : Number(e.target.value) },
                })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Valor máximo</Label>
            <Input
              type="number"
              className="h-9"
              value={pergunta.config.valor_max ?? ""}
              onChange={(e) =>
                onChange({
                  config: { ...pergunta.config, valor_max: e.target.value === "" ? undefined : Number(e.target.value) },
                })
              }
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label className="text-xs">Tolerância</Label>
            <Input
              type="number"
              className="h-9"
              value={pergunta.config.tolerancia ?? ""}
              onChange={(e) =>
                onChange({
                  config: { ...pergunta.config, tolerancia: e.target.value === "" ? undefined : Number(e.target.value) },
                })
              }
            />
          </div>
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

    case "checklist":
      return (
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Escala</Label>
          <Select
            value={pergunta.config.escala ?? "sim_nao_na"}
            onValueChange={(v) =>
              onChange({ config: { ...pergunta.config, escala: v as "sim_nao_na" | "sim_parcial_nao_na" } })
            }
          >
            <SelectTrigger className="h-9 w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="sim_nao_na">Sim / Não / Não avaliado</SelectItem>
              <SelectItem value="sim_parcial_nao_na">
                Realizou / Parcialmente / Não realizou / Não avaliado
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      );

    default:
      return null;
  }
}
