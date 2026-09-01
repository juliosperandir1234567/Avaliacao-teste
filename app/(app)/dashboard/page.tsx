import { CheckCircle2, AlertTriangle, GraduationCap, XCircle, ShieldAlert } from "lucide-react";
import { getDashboardData, listAvaliacoesParaFiltro } from "./actions";
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
  BarraCompetencias,
  LinhaEvolucao,
} from "@/components/dashboard-charts";
import type { Parecer, TipoPessoa } from "@/lib/types";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    dataInicio?: string;
    dataFim?: string;
    tipoPessoa?: string;
    avaliacaoId?: string;
    resultado?: string;
  }>;
}) {
  const params = await searchParams;
  const filtros = {
    dataInicio: params.dataInicio || undefined,
    dataFim: params.dataFim || undefined,
    tipoPessoa: (params.tipoPessoa as TipoPessoa) || undefined,
    avaliacaoId: params.avaliacaoId || undefined,
    resultado: (params.resultado as Parecer) || undefined,
  };

  const [dados, avaliacoes] = await Promise.all([getDashboardData(filtros), listAvaliacoesParaFiltro()]);

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
          <Select name="tipoPessoa" defaultValue={params.tipoPessoa}>
            <SelectTrigger className="h-9 w-36">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="interno">Interno</SelectItem>
              <SelectItem value="externo">Externo</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField label="Avaliação">
          <Select name="avaliacaoId" defaultValue={params.avaliacaoId}>
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
      </form>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total de avaliações" value={dados.totais.total} />
        <StatCard label="Hoje" value={dados.totais.hoje} />
        <StatCard label="No mês" value={dados.totais.noMes} />
        <StatCard label="Internos" value={dados.totais.internos} />
        <StatCard label="Externos" value={dados.totais.externos} />
        <StatCard label="Nota média" value={dados.notaMedia !== null ? dados.notaMedia.toFixed(1) : "-"} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatusCard icon={CheckCircle2} color="#0ca30c" label="Aptos" value={dados.parecerCount.apto} />
        <StatusCard
          icon={AlertTriangle}
          color="#fab219"
          label="Apto c/ acompanhamento"
          value={dados.parecerCount.apto_acompanhamento}
        />
        <StatusCard
          icon={GraduationCap}
          color="#ec835a"
          label="Necessita treinamento"
          value={dados.parecerCount.necessita_treinamento}
        />
        <StatusCard icon={XCircle} color="#d03b3b" label="Não recomendados" value={dados.parecerCount.nao_recomendado} />
      </div>

      {dados.totais.falhasCriticas > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          <ShieldAlert className="size-4" />
          {dados.totais.falhasCriticas} falha(s) crítica(s) registradas no período filtrado
        </div>
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
            <CardTitle className="text-base">Desempenho por competência</CardTitle>
          </CardHeader>
          <CardContent>
            <BarraCompetencias data={dados.desempenhoPorCompetencia} />
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
      <CardContent className="p-3">
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
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
      <CardContent className="flex items-center gap-3 p-3">
        <Icon className="size-6 shrink-0" style={{ color }} />
        <div>
          <p className="text-lg font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
