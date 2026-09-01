"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { createEquipamentoTipo } from "../actions";

export function NovoEquipamentoForm() {
  const router = useRouter();
  const [familia, setFamilia] = useState("");
  const [nome, setNome] = useState("");
  const [pending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await createEquipamentoTipo(familia, nome);
          if (result.error) {
            toast.error(result.error);
            return;
          }
          setFamilia("");
          setNome("");
          toast.success("Equipamento adicionado");
          router.refresh();
        });
      }}
    >
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="familia">Família</Label>
        <Input id="familia" className="h-10" value={familia} onChange={(e) => setFamilia(e.target.value)} placeholder="Ex: Linha Amarela" required />
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <Label htmlFor="nome">Equipamento</Label>
        <Input id="nome" className="h-10" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Escavadeira" required />
      </div>
      <Button type="submit" disabled={pending} className="h-10">
        Adicionar
      </Button>
    </form>
  );
}
