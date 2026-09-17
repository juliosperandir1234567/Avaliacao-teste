"use client";

import { useRef, useState, useTransition } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { importarCandidatosLote, type LinhaImportacao } from "@/app/(app)/candidatos/actions";
import type { TipoPessoa } from "@/lib/types";

// Aceita variações comuns de nome de coluna (acento, espaço, maiúscula) pro mesmo campo.
const ALIASES: Record<string, keyof LinhaImportacao> = {
  matricula: "matricula",
  "código": "matricula",
  codigo: "matricula",
  nome: "nome",
  cpf: "cpf",
  cargo: "cargo",
  "função": "cargo",
  funcao: "cargo",
  observação: "observacoes",
  observacao: "observacoes",
  observações: "observacoes",
  observacoes: "observacoes",
  "tipo de teste": "avaliacaoNome",
  tipo_teste: "avaliacaoNome",
  avaliação: "avaliacaoNome",
  avaliacao: "avaliacaoNome",
};

function normalizarCabecalho(cabecalho: string) {
  const chave = cabecalho.trim().toLowerCase();
  return ALIASES[chave];
}

interface LinhaParsed {
  linha: number;
  dados: Partial<Record<keyof LinhaImportacao, string>>;
}

const COLUNAS_POR_TIPO: Record<TipoPessoa, { campo: keyof LinhaImportacao; label: string }[]> = {
  interno: [
    { campo: "matricula", label: "Matrícula" },
    { campo: "nome", label: "Nome" },
    { campo: "cargo", label: "Função" },
    { campo: "observacoes", label: "Observação" },
    { campo: "avaliacaoNome", label: "Tipo de teste" },
  ],
  externo: [
    { campo: "matricula", label: "Matrícula" },
    { campo: "nome", label: "Nome" },
    { campo: "cpf", label: "CPF" },
    { campo: "observacoes", label: "Observação" },
    { campo: "avaliacaoNome", label: "Tipo de teste" },
  ],
};

export function ImportarCandidatosForm() {
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("externo");
  const [linhas, setLinhas] = useState<LinhaParsed[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [resultado, setResultado] = useState<{ novos: number; existentes: number; erros: { linha: number; motivo: string }[] } | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function processarArquivo(file: File) {
    setResultado(null);
    setNomeArquivo(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const parsed: LinhaParsed[] = results.data.map((row, i) => {
          const dados: Partial<Record<keyof LinhaImportacao, string>> = {};
          for (const [cabecalho, valor] of Object.entries(row)) {
            const campo = normalizarCabecalho(cabecalho);
            if (campo && valor) dados[campo] = String(valor).trim();
          }
          return { linha: i + 2, dados };
        });
        setLinhas(parsed);
        if (parsed.length === 0) toast.error("Nenhuma linha encontrada no arquivo.");
      },
      error: (err) => toast.error("Falha ao ler o arquivo: " + err.message),
    });
  }

  function confirmarImportacao() {
    const payload: LinhaImportacao[] = linhas.map((l) => ({
      tipoPessoa,
      matricula: l.dados.matricula ?? "",
      nome: l.dados.nome ?? "",
      cargo: l.dados.cargo,
      cpf: l.dados.cpf,
      observacoes: l.dados.observacoes,
      avaliacaoNome: l.dados.avaliacaoNome ?? "",
    }));

    startTransition(async () => {
      const result = await importarCandidatosLote(payload);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setResultado(result);
      if (result.erros.length === 0) {
        toast.success(`${result.novos + result.existentes} candidato(s) importado(s).`);
      }
    });
  }

  const colunas = COLUNAS_POR_TIPO[tipoPessoa];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar candidatos em massa</CardTitle>
        <CardDescription>
          Arquivo CSV com cabeçalho na primeira linha. Colunas esperadas para {tipoPessoa === "interno" ? "teste interno" : "teste externo"}:{" "}
          {colunas.map((c) => c.label).join(", ")}. A coluna &quot;Tipo de teste&quot; deve ter o nome exato
          de uma avaliação publicada.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex gap-3">
          <Button
            type="button"
            variant={tipoPessoa === "interno" ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setTipoPessoa("interno");
              setLinhas([]);
              setResultado(null);
              setNomeArquivo("");
            }}
          >
            Interno
          </Button>
          <Button
            type="button"
            variant={tipoPessoa === "externo" ? "default" : "outline"}
            className="flex-1"
            onClick={() => {
              setTipoPessoa("externo");
              setLinhas([]);
              setResultado(null);
              setNomeArquivo("");
            }}
          >
            Externo
          </Button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processarArquivo(file);
          }}
        />
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          {nomeArquivo || "Selecionar arquivo CSV"}
        </Button>

        {linhas.length > 0 ? (
          <>
            <p className="text-sm text-muted-foreground">{linhas.length} linha(s) encontrada(s) no arquivo.</p>
            <div className="max-h-80 overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Linha</th>
                    {colunas.map((c) => (
                      <th key={c.campo} className="px-2 py-1.5 font-medium">
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {linhas.map((l) => (
                    <tr key={l.linha}>
                      <td className="px-2 py-1.5 text-muted-foreground">{l.linha}</td>
                      {colunas.map((c) => (
                        <td key={c.campo} className="px-2 py-1.5">
                          {l.dados[c.campo] || <span className="text-muted-foreground">-</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={confirmarImportacao} disabled={pending} className="h-11">
              {pending ? "Importando..." : `Importar ${linhas.length} linha(s)`}
            </Button>
          </>
        ) : null}

        {resultado ? (
          <div className="flex flex-col gap-2 rounded-md border p-3 text-sm">
            <div className="flex gap-2">
              <Badge variant="secondary">{resultado.novos} novo(s)</Badge>
              <Badge variant="secondary">{resultado.existentes} atualizado(s)</Badge>
              {resultado.erros.length > 0 ? (
                <Badge variant="destructive">{resultado.erros.length} erro(s)</Badge>
              ) : null}
            </div>
            {resultado.erros.length > 0 ? (
              <ul className="flex flex-col gap-1 text-destructive">
                {resultado.erros.map((e, i) => (
                  <li key={i}>
                    Linha {e.linha}: {e.motivo}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
