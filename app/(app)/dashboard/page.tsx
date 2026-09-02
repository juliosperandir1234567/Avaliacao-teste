import Link from "next/link";
import { CheckCircle2, Ban, ShieldAlert } from "lucide-react";
import { getDashboardData, listAvaliacoesParaFiltro, listFuncoesParaFiltro } from "./actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  BarraNotaMedia,
  BarraDistribuicao,
  LinhaEvolucao,
} from "@/components/dashboard-charts";
import { PARECER_LABELS, type Parecer, type TipoPessoa } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    dataInicio?: string;
    dataFim?: string;
    tipoPessoa?: string;
    avaliacaoId?: string;
    resultado?: string;
    funcao?: string;
  }>;
}) {
  const params = await searchParams;
  const filtros = {
    dataInicio: params.dataInicio || undefined,
    dataFim: params.dataFim || undefined,
    tipoPessoa: (params.tipoPessoa as TipoPessoa) || undefined,
    avaliacaoId: params.avaliacaoId || undefined,
    resultado: (params.resultado as Parecer) || undefined,
    funcao: params.funcao || undefined,
  };
  const temFiltroAtivo = Object.values(filtros).some(Boolean);

  const [dados, avaliacoes, funcoes] = await Promise.all([
    getDashboardData(filtros),
    listAvaliacoesParaFiltro(),
    listFuncoesParaFiltro(),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Dashboard Executivo</h1>

      <form className="flex flex-wrap items-end gap-2" action="/dashboard">
        <FilterField label="De">
          <Input type="date" name="dataInicio" defaultValue={params.dataInicio} className="h-9 w-36" />
        </FilterField>
        <FilterField label="Até">
          <Input type="date" name="dataFim" defaultValue={params.dataFim} className="h-9 w-36" />
        </FilterField>
        <FilterField label="Tipo">
          <Select items={{ interno: "Interno", externo: "Externo" }} name="tipoPessoa" defaultValue={params.tipoPessoa}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interno">Interno</SelectItem>
              <SelectItem value="externo">Externo</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Função">
          <Select name="funcao" defaultValue={params.funcao}>
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {funcoes.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Avaliação">
          <Select
            items={avaliacoes.map((a) => ({ value: a.id, label: a.nome }))}
            name="avaliacaoId"
            defaultValue={params.avaliacaoId}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue placeholder="Todas" />
            </SelectTrigger>
            <SelectContent>
              {avaliacoes.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <Button type="submit" size="sm" variant="secondary" className="h-9">
          Filtrar
        </Button>
        {temFiltroAtivo ? (
          <Button size="sm" variant="ghost" className="h-9" render={<Link href="/dashboard">Limpar filtro</Link>} />
        ) : null}
      </form>

      <div className="grid grid-cols-4 gap-2 sm:grid-cols-4 lg:grid-cols-8">
        <StatCard label="Total de avaliações" value={dados.totais.total} />
        <StatCard label="Hoje" value={dados.totais.hoje} />
        <StatCard label="No mês" value={dados.totais.noMes} />
        <StatCard label="Internos" value={dados.totais.internos} />
        <StatCard label="Externos" value={dados.totais.externos} />
        <StatCard label="Nota média" value={dados.notaMedia !== null ? dados.notaMedia.toFixed(1) : "-"} />
        <StatusCard icon={CheckCircle2} color="#0ca30c" label="Aptos" value={dados.parecerCount.apto} />
        <StatusCard icon={Ban} color="#d03b3b" label="Reprovados" value={dados.parecerCount.reprovado} />
      </div>

      {dados.totais.falhasCriticas > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          <ShieldAlert className="size-4" />
          {dados.totais.falhasCriticas} falha(s) crítica(s) registradas no período filtrado
        </div>
      ) : null}

      {params.funcao ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultados individuais — {params.funcao}</CardTitle>
          </CardHeader>
          <CardContent>
            {dados.resultadosIndividuais.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum resultado no período filtrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="py-1.5 pr-3 font-medium">Nome</th>
                      <th className="py-1.5 pr-3 font-medium">Tipo</th>
                      <th className="py-1.5 pr-3 font-medium">Data</th>
                      <th className="py-1.5 pr-3 font-medium">Nota</th>
                      <th className="py-1.5 pr-3 font-medium">Parecer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dados.resultadosIndividuais.map((r, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-1.5 pr-3">{r.nome}</td>
                        <td className="py-1.5 pr-3 capitalize">{r.tipoPessoa}</td>
                        <td className="py-1.5 pr-3">{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                        <td className="py-1.5 pr-3 font-medium">
                          {r.notaGeral !== null ? r.notaGeral.toFixed(1) : "-"}
                        </td>
                        <td className="py-1.5 pr-3">{r.parecerFinal ? PARECER_LABELS[r.parecerFinal] : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Resultados por avaliação</CardTitle>
          </CardHeader>
          <CardContent>
            <BarraNotaMedia data={dados.resultadosPorAvaliacao} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Nota média por função</CardTitle>
          </CardHeader>
          <CardContent>
            <BarraNotaMedia data={dados.notaPorFuncao} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição das notas</CardTitle>
          </CardHeader>
          <CardContent>
            <BarraDistribuicao data={dados.distribuicaoNotas} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evolução da nota média</CardTitle>
          </CardHeader>
          <CardContent>
            <LinhaEvolucao data={dados.evolucaoTemporal} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Itens com maior índice de falha crítica</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {dados.principaisFalhas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma falha crítica registrada.</p>
          ) : (
            dados.principaisFalhas.map((f, i) => {
              const max = dados.principaisFalhas[0].total;
              return (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="w-5 text-right text-muted-foreground">{i + 1}.</span>
                  <span className="flex-1 truncate">{f.enunciado}</span>
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-[#d03b3b]"
                      style={{ width: `${(f.total / max) * 100}%` }}
                    />
                  </div>
                  <span className="w-6 text-right font-medium">{f.total}</span>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-1.5">
        <p className="truncate text-[10px] text-muted-foreground">{label}</p>
        <p className="text-base font-bold">{value}</p>
      </CardContent>
    </Card>
  );
}

function StatusCard({
  icon: Icon,
  color,
  label,
  value,
}: {
  icon: typeof CheckCircle2;
  color: string;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-1.5 p-1.5">
        <Icon className="size-3.5 shrink-0" style={{ color }} />
        <div className="min-w-0">
          <p className="truncate text-[10px] text-muted-foreground">{label}</p>
          <p className="text-base font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
