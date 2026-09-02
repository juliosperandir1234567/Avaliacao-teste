"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarCandidatoEPendencia } from "@/app/(app)/candidatos/actions";
import type { TipoPessoa } from "@/lib/types";

interface AvaliacaoOpcao {
  id: string;
  nome: string;
  funcao: string;
}

export function CandidatoForm({ avaliacoes }: { avaliacoes: AvaliacaoOpcao[] }) {
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("externo");
  const [pending, startTransition] = useTransition();

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [possuiCnh, setPossuiCnh] = useState(false);
  const [categoriaCnh, setCategoriaCnh] = useState("");
  const [ultimoEmprego, setUltimoEmprego] = useState("");
  const [observacoes, setObservacoes] = useState("");

  const [matricula, setMatricula] = useState("");
  const [cargo, setCargo] = useState("");
  const [estrutura, setEstrutura] = useState("");

  const [avaliacaoId, setAvaliacaoId] = useState("");

  function submit() {
    startTransition(async () => {
      const input =
        tipoPessoa === "externo"
          ? {
              tipoPessoa: "externo" as const,
              nome,
              telefone,
              possuiCnh,
              categoriaCnh,
              avaliacaoId,
              ultimoEmprego,
              observacoes,
            }
          : {
              tipoPessoa: "interno" as const,
              matricula,
              nome,
              cargo,
              estrutura,
              possuiCnh,
              categoriaCnh,
              observacoes,
              avaliacaoId,
            };

      const result = await criarCandidatoEPendencia(input);
      if (result?.error) toast.error(result.error);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Novo Candidato</CardTitle>
        <CardDescription>Cadastre e o sistema já cria a pendência de teste.</CardDescription>
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

        {tipoPessoa === "interno" ? (
          <>
            <Field label="Código (matrícula)">
              <Input className="h-11" value={matricula} onChange={(e) => setMatricula(e.target.value)} />
            </Field>
            <Field label="Nome">
              <Input className="h-11" value={nome} onChange={(e) => setNome(e.target.value)} />
            </Field>
            <Field label="Função">
              <Input className="h-11" value={cargo} onChange={(e) => setCargo(e.target.value)} />
            </Field>
            <Field label="Estrutura">
              <Input className="h-11" value={estrutura} onChange={(e) => setEstrutura(e.target.value)} />
            </Field>
          </>
        ) : (
          <>
            <Field label="Nome">
              <Input className="h-11" value={nome} onChange={(e) => setNome(e.target.value)} />
            </Field>
            <Field label="Telefone">
              <Input className="h-11" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </Field>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center justify-between rounded-md border p-3">
            <Label htmlFor="possui_cnh">Possui CNH?</Label>
            <Switch id="possui_cnh" checked={possuiCnh} onCheckedChange={setPossuiCnh} />
          </div>
          <Field label="Letra da CNH">
            <Input
              className="h-11"
              value={categoriaCnh}
              onChange={(e) => setCategoriaCnh(e.target.value)}
              placeholder="Ex: B, C, D"
              disabled={!possuiCnh}
            />
          </Field>
        </div>

        {tipoPessoa === "externo" ? (
          <Field label="Último emprego">
            <Input className="h-11" value={ultimoEmprego} onChange={(e) => setUltimoEmprego(e.target.value)} />
          </Field>
        ) : null}

        <Field label="Observações">
          <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
        </Field>

        <Field label="Tipo de teste / Avaliação">
          {avaliacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhuma avaliação publicada ainda. Crie e publique uma em Avaliação antes de cadastrar
              candidatos.
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
        </Field>

        <Button onClick={submit} disabled={pending || !avaliacaoId} className="h-11">
          {pending ? "Cadastrando..." : "Cadastrar Candidato"}
        </Button>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
