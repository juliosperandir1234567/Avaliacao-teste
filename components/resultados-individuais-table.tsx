"use client";

import Link from "next/link";
import { EditarResultadoButton } from "@/components/editar-resultado-button";
import { CnhHover, OlhoComCnh } from "@/components/olho-com-cnh";

const TH = "px-2 py-1.5";
const TD = "px-2 py-1";
import { BuscaTabela, ThOrdenavel, useTabelaOrdenavel } from "@/components/tabela-ordenavel";
import { PARECER_LABELS, type Parecer } from "@/lib/types";

export interface ResultadoIndividual {
  id: string;
  nome: string;
  tipoPessoa: string;
  data: string;
  notaGeral: number | null;
  parecerFinal: Parecer | null;
  observacaoAvaliador: string | null;
  observacaoGestor: string | null;
  fotoCnhPath: string | null;
}

const PARECER_BADGE: Partial<Record<Parecer, string>> = {
  apto: "bg-green-100 text-green-800",
  reprovado: "bg-red-100 text-red-800",
  nao_recomendado: "bg-red-100 text-red-800",
};

function ParecerBadge({ parecer }: { parecer: Parecer }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${
        PARECER_BADGE[parecer] ?? "bg-amber-100 text-amber-800"
      }`}
    >
      {PARECER_LABELS[parecer]}
    </span>
  );
}

export function ResultadosIndividuaisTable({
  resultados,
  isAdmin,
}: {
  resultados: ResultadoIndividual[];
  isAdmin: boolean;
}) {
  const { visiveis, ordem, alternar, busca, setBusca } = useTabelaOrdenavel({
    linhas: resultados,
    colunas: {
      nome: (r) => r.nome,
      tipo: (r) => r.tipoPessoa,
      data: (r) => r.data,
      nota: (r) => r.notaGeral,
      parecer: (r) => (r.parecerFinal ? PARECER_LABELS[r.parecerFinal] : null),
      observacao: (r) => r.observacaoAvaliador || r.observacaoGestor,
    },
    buscaEm: (r) => [r.nome],
    inicial: { coluna: "nome", direcao: "asc" },
  });

  return (
    <div className="flex flex-col gap-2">
      <BuscaTabela valor={busca} onChange={setBusca} total={resultados.length} visiveis={visiveis.length} />
      {/* Altura de ~10 linhas; o resto fica na rolagem (cabeçalho fixo). */}
      <div className="max-h-[30rem] overflow-auto rounded-md border">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr className="text-left text-xs text-muted-foreground">
              <ThOrdenavel coluna="nome" ordem={ordem} onClick={alternar} className={TH}>Nome</ThOrdenavel>
              <ThOrdenavel coluna="tipo" ordem={ordem} onClick={alternar} className={TH}>Tipo</ThOrdenavel>
              <ThOrdenavel coluna="data" ordem={ordem} onClick={alternar} className={TH}>Data</ThOrdenavel>
              <ThOrdenavel coluna="nota" ordem={ordem} onClick={alternar} className={TH}>Nota</ThOrdenavel>
              <ThOrdenavel coluna="parecer" ordem={ordem} onClick={alternar} className={TH}>Parecer</ThOrdenavel>
              <ThOrdenavel coluna="observacao" ordem={ordem} onClick={alternar} className={TH}>Observação</ThOrdenavel>
              <th className={TH} />
            </tr>
          </thead>
          <tbody>
            {visiveis.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-2 py-3 text-center text-muted-foreground">
                  Nenhum nome encontrado.
                </td>
              </tr>
            ) : (
              visiveis.map((r) => (
                <tr key={r.id} className="border-t align-top hover:bg-muted/40">
                  <td className={`${TD} whitespace-nowrap`}>
                    {/* Passar o mouse no nome mostra a foto da CNH */}
                    <CnhHover fotoCnhPath={r.fotoCnhPath}>
                      <Link href={`/aplicacoes/${r.id}/raiox`} className="font-medium text-primary hover:underline">
                        {r.nome}
                      </Link>
                    </CnhHover>
                  </td>
                  <td className={`${TD} capitalize`}>{r.tipoPessoa}</td>
                  <td className={`${TD} whitespace-nowrap`}>{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                  <td className={`${TD} font-semibold`}>{r.notaGeral !== null ? r.notaGeral.toFixed(1) : "-"}</td>
                  <td className={TD}>{r.parecerFinal ? <ParecerBadge parecer={r.parecerFinal} /> : "-"}</td>
                  <td className={`${TD} min-w-48 whitespace-pre-line text-muted-foreground`}>
                    {r.observacaoAvaliador || r.observacaoGestor ? (
                      <>
                        {r.observacaoAvaliador ? <p>{r.observacaoAvaliador}</p> : null}
                        {r.observacaoGestor ? (
                          <p>
                            <span className="font-medium text-foreground">Gestor: </span>
                            {r.observacaoGestor}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-1 py-0.5">
                    <div className="flex items-center">
                      <OlhoComCnh href={`/aplicacoes/${r.id}/relatorio`} fotoCnhPath={r.fotoCnhPath} />
                      {isAdmin ? <EditarResultadoButton aplicacaoId={r.id} nome={r.nome} /> : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
