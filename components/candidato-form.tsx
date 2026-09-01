"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
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
import {
  criarCandidatoEPendencia,
  confirmarAvaliacaoManual,
  type CriarCandidatoResultado,
} from "@/app/(app)/candidatos/actions";
import type { TipoPessoa } from "@/lib/types";

export function CandidatoForm() {
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

  const [funcaoPretendida, setFuncaoPretendida] = useState("");

  const [escolhaManual, setEscolhaManual] = useState<CriarCandidatoResultado | null>(null);
  const [avaliacaoEscolhida, setAvaliacaoEscolhida] = useState("");

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
              funcaoPretendida,
              ultimoEmprego,
              observacoes,
            }
          : {
              tipoPessoa: "interno" as const,
              matricula,
              nome,
              cargo,
              estrutura,
              funcaoPretendida,
            };

      const result = await criarCandidatoEPendencia(input);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      if (result?.precisaEscolherAvaliacao) {
        setEscolhaManual(result);
        toast.info(
          (result.opcoes ?? []).length === 0
            ? "Nenhuma avaliação publicada para essa função. Escolha uma manualmente."
            : "Mais de uma avaliação encontrada para essa função. Escolha qual usar."
        );
      }
    });
  }

  function confirmar() {
    if (!escolhaManual || !avaliacaoEscolhida) return;
    startTransition(async () => {
      const result = await confirmarAvaliacaoManual({
        tipoPessoa: escolhaManual.tipoPessoa as TipoPessoa,
        avaliacaoId: avaliacaoEscolhida,
        candidatoExternoId: escolhaManual.candidatoExternoId,
        colaboradorId: escolhaManual.colaboradorId,
        colaboradorSnapshot: escolhaManual.colaboradorSnapshot,
      });
      if (result?.error) toast.error(result.error);
    });
  }

  if (escolhaManual) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Escolha a avaliação</CardTitle>
          <CardDescription>
            Não encontramos exatamente uma avaliação publicada para &quot;{funcaoPretendida}&quot;.
            Selecione manualmente.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(escolhaManual.opcoes ?? []).length === 0 ? (
            <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
              Não há nenhuma avaliação publicada ainda. Crie e publique uma avaliação em{" "}
              <Link href="/avaliacoes/novo" className="text-primary hover:underline">
                Avaliação
              </Link>{" "}
              antes de registrar este candidato.
            </p>
          ) : (
            <>
              <Select value={avaliacaoEscolhida} onValueChange={(v) => setAvaliacaoEscolhida(v ?? "")}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione a avaliação" />
                </SelectTrigger>
                <SelectContent>
                  {(escolhaManual.opcoes ?? []).map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.nome} — {a.funcao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={confirmar} disabled={pending || !avaliacaoEscolhida} className="h-11">
                {pending ? "Registrando..." : "Registrar Pendência"}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    );
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
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label htmlFor="possui_cnh">Possui CNH?</Label>
              <Switch id="possui_cnh" checked={possuiCnh} onCheckedChange={setPossuiCnh} />
            </div>
            {possuiCnh ? (
              <Field label="Categoria CNH">
                <Input className="h-11" value={categoriaCnh} onChange={(e) => setCategoriaCnh(e.target.value)} />
              </Field>
            ) : null}
            <Field label="Último emprego">
              <Input className="h-11" value={ultimoEmprego} onChange={(e) => setUltimoEmprego(e.target.value)} />
            </Field>
            <Field label="Observações">
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </Field>
          </>
        )}

        <Field label="Tipo de teste / Função pretendida">
          <Input
            className="h-11"
            value={funcaoPretendida}
            onChange={(e) => setFuncaoPretendida(e.target.value)}
          />
        </Field>

        <Button onClick={submit} disabled={pending} className="h-11">
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
