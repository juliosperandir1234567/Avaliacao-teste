"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function ChecklistBulkAdd({ onAdd }: { onAdd: (itens: string[]) => void }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");

  if (!aberto) {
    return (
      <Button variant="outline" size="sm" type="button" onClick={() => setAberto(true)}>
        + Vários itens de checklist
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-dashed p-3">
      <Textarea
        placeholder={"Um item por linha, ex:\nÁgua da bateria\nFaróis\nRetrovisor"}
        rows={6}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
      />
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const itens = texto
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean);
            if (itens.length === 0) return;
            onAdd(itens);
            setTexto("");
            setAberto(false);
          }}
        >
          Adicionar itens
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setAberto(false);
            setTexto("");
          }}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
