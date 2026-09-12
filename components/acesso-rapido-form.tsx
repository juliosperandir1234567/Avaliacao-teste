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
import { criarAcessoRapido } from "@/app/(app)/candidatos/actions";
import type { TipoPessoa } from "@/lib/types";

interface AvaliacaoOpcao {
  id: string;
  nome: string;
  funcao: string;
}

export function AcessoRapidoForm({ avaliacoes }: { avaliacoes: AvaliacaoOpcao[] }) {
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("externo");
  const [nome, setNome] = useState("");
  const [matricula, setMatricula] = useState("");
  const [avaliacaoId, setAvaliacaoId] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await criarAcessoRapido({ tipoPessoa, nome, matricula, avaliacaoId });
      if (result?.error) toast.error(result.error);
    });
  }

  const podeEnviar = Boolean(nome.trim() && (tipoPessoa === "externo" || matricula.trim()) && avaliacaoId);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acesso rápido</CardTitle>
        <CardDescription>
          {tipoPessoa === "interno"
            ? "Nome, matrícula e tipo de teste -- já cai direto na prova. Se a matrícula já estiver cadastrada (na mão ou por importação em massa), reaproveita os dados dela; senão cria um colaborador novo com esse nome."
            : "Nome e tipo de teste -- já cai direto na prova, sem precisar do cadastro completo."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Button
            type="button"
            variant={tipoPessoa === "interno" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setTipoPessoa("interno")}
          >
            Interno
          </Button>
          <Button
            type="button"
            variant={tipoPessoa === "externo" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setTipoPessoa("externo")}
          >
            Externo
          </Button>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Nome</Label>
          <Input
            className="h-11"
            value={nome}
            onChange={(e) => setNome(e.target.value.toUpperCase())}
          />
        </div>

        {tipoPessoa === "interno" ? (
          <div className="flex flex-col gap-1.5">
            <Label>Matrícula</Label>
            <Input
              className="h-11"
              value={matricula}
              onChange={(e) => setMatricula(e.target.value.toUpperCase())}
            />
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <Label>Tipo de teste / Avaliação</Label>
          {avaliacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma avaliação publicada ainda. Crie e publique uma em Avaliação antes.
            </p>
          ) : (
            <Select
              items={avaliacoes.map((a) => ({ value: a.id, label: `${a.nome} — ${a.funcao}` }))}
              value={avaliacaoId}
              onValueChange={(v) => setAvaliacaoId(v ?? "")}
            >
              <SelectTrigger className="h-11 w-full">
                <SelectValue placeholder="Selecione a avaliação" className="truncate whitespace-nowrap" />
              </SelectTrigger>
              <SelectContent>
                {avaliacoes.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.nome} — {a.funcao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        <Button onClick={submit} disabled={pending || !podeEnviar} className="h-11">
          {pending ? "Abrindo prova..." : "Aplicar prova"}
        </Button>
      </CardContent>
    </Card>
  );
}
