"use client";

import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import type { AvaliacaoAlternativa, AvaliacaoPergunta, ChecklistStatus, RespostaValor } from "@/lib/types";

export function QuestionInput({
  pergunta,
  alternativas,
  value,
  onChange,
}: {
  pergunta: AvaliacaoPergunta;
  alternativas: AvaliacaoAlternativa[];
  value: RespostaValor | undefined;
  onChange: (value: RespostaValor) => void;
}) {
  switch (pergunta.tipo) {
    case "multipla_escolha": {
      const selecionada = value && "alternativa_id" in value ? value.alternativa_id : null;
      return (
        <div className="flex flex-col gap-2">
          {alternativas.map((alt) => (
            <OptionButton
              key={alt.id}
              selected={selecionada === alt.id}
              onClick={() => onChange({ alternativa_id: alt.id })}
              label={alt.texto}
            />
          ))}
        </div>
      );
    }

    case "multiplas_respostas": {
      const selecionadas = value && "alternativa_ids" in value ? value.alternativa_ids : [];
      return (
        <div className="flex flex-col gap-2">
          {alternativas.map((alt) => {
            const checked = selecionadas.includes(alt.id);
            return (
              <label
                key={alt.id}
                className="flex items-center gap-3 rounded-md border p-3 text-sm has-[[data-checked]]:border-primary"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const novo = v
                      ? [...selecionadas, alt.id]
                      : selecionadas.filter((id) => id !== alt.id);
                    onChange({ alternativa_ids: novo });
                  }}
                />
                {alt.texto}
              </label>
            );
          })}
        </div>
      );
    }

    case "verdadeiro_falso": {
      const atual = value && "valor_bool" in value ? value.valor_bool : null;
      return (
        <div className="grid grid-cols-2 gap-3">
          <OptionButton selected={atual === true} onClick={() => onChange({ valor_bool: true })} label="Verdadeiro" />
          <OptionButton selected={atual === false} onClick={() => onChange({ valor_bool: false })} label="Falso" />
        </div>
      );
    }

    case "sim_nao": {
      const atual = value && "valor_bool" in value ? value.valor_bool : null;
      return (
        <div className="grid grid-cols-2 gap-3">
          <OptionButton selected={atual === true} onClick={() => onChange({ valor_bool: true })} label="Sim" />
          <OptionButton selected={atual === false} onClick={() => onChange({ valor_bool: false })} label="Não" />
        </div>
      );
    }

    case "checklist": {
      const atual = value && "status" in value ? value.status : null;
      const opcoes: { status: ChecklistStatus; label: string }[] = [
        { status: "sim", label: "Sim" },
        { status: "nao", label: "Não" },
      ];
      return (
        <div className="flex flex-col gap-2">
          {opcoes.map((op) => (
            <OptionButton
              key={op.status}
              selected={atual === op.status}
              onClick={() => onChange({ status: op.status })}
              label={op.label}
            />
          ))}
        </div>
      );
    }

    case "numerica": {
      const atual = value && "valor_numerico" in value ? value.valor_numerico : null;
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            className="h-11"
            value={atual ?? ""}
            onChange={(e) => onChange({ valor_numerico: e.target.value === "" ? null : Number(e.target.value) })}
          />
          {pergunta.config.unidade ? (
            <span className="text-sm text-muted-foreground">{pergunta.config.unidade}</span>
          ) : null}
        </div>
      );
    }

    case "aberta_curta": {
      const atual = value && "texto" in value ? value.texto : "";
      return <Input className="h-11" value={atual} onChange={(e) => onChange({ texto: e.target.value })} />;
    }

    case "aberta_longa": {
      const atual = value && "texto" in value ? value.texto : "";
      return <Textarea rows={5} value={atual} onChange={(e) => onChange({ texto: e.target.value })} />;
    }
  }
}

function OptionButton({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant={selected ? "default" : "outline"}
      className="h-auto min-h-11 justify-start whitespace-normal px-4 py-3 text-left text-sm"
      onClick={onClick}
    >
      {label}
    </Button>
  );
}
