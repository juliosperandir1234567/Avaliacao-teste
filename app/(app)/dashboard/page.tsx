import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Ban,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ClipboardList,
  Gauge,
  LineChart,
  ListOrdered,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { getCurrentProfile } from "@/lib/auth";
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

type DashboardParams = {
  dataInicio?: string;
  dataFim?: string;
  tipoPessoa?: string;
  avaliacaoId?: string;
  resultado?: string;
  funcao?: string;
  codigo?: string;
  cpfOuNome?: string;
};

/** Monta o link do dashboard mantendo os filtros atuais e aplicando `mudancas` (undefined = remove). */
function hrefDashboard(params: DashboardParams, mudancas: Partial<DashboardParams>) {
  const novo: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...params, ...mudancas })) {
    if (v) novo[k] = v;
  }
  const qs = new URLSearchParams(novo).toString();
  return qs ? `/dashboard?${qs}` : "/dashboard";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<DashboardParams>;
}) {
  const profile = await getCurrentProfile();
  if (profile.role === "gestor") redirect("/");

  const params = await searchParams;
  const filtros = {
    dataInicio: params.dataInicio || undefined,
    dataFim: params.dataFim || undefined,
    tipoPessoa: (params.tipoPessoa as TipoPessoa) || undefined,
    avaliacaoId: params.avaliacaoId || undefined,
    resultado: (params.resultado as Parecer) || undefined,
    funcao: params.funcao || undefined,
    codigo: params.codigo || undefined,
    cpfOuNome: params.cpfOuNome || undefined,
  };
  const temFiltroAtivo = Object.values(filtros).some(Boolean);

  const [dados, avaliacoes, funcoes] = await Promise.all([
    getDashboardData(filtros),
    listAvaliacoesParaFiltro(),
    listFuncoesParaFiltro(),
  ]);

  // Mesmas datas que getDashboardData usa pra contar "Hoje" e "No mês".
  const hoje = new Date().toISOString().slice(0, 10);
  const inicioMes = hoje.slice(0, 7) + "-01";
  const filtroHoje = params.dataInicio === hoje && params.dataFim === hoje;
  const filtroMes = params.dataInicio === inicioMes && !params.dataFim;

  // Cards clicáveis: clicar aplica o filtro; clicar de novo no card ativo tira o filtro.
  const cards: StatCardProps[] = [
    {
      label: "Total de avaliações",
      value: dados.totais.total,
      icon: ClipboardList,
      cor: "#2a78d6",
      href: hrefDashboard(params, { resultado: undefined, tipoPessoa: undefined }),
      ativo: false,
      titulo: "Mostrar todas (tira filtro de tipo e resultado)",
    },
    {
      label: "Hoje",
      value: dados.totais.hoje,
      icon: CalendarDays,
      cor: "#1baf7a",
      href: hrefDashboard(params, filtroHoje ? { dataInicio: undefined, dataFim: undefined } : { dataInicio: hoje, dataFim: hoje }),
      ativo: filtroHoje,
    },
    {
      label: "No mês",
      value: dados.totais.noMes,
      icon: CalendarRange,
      cor: "#4a3aa7",
      href: hrefDashboard(params, filtroMes ? { dataInicio: undefined, dataFim: undefined } : { dataInicio: inicioMes, dataFim: undefined }),
      ativo: filtroMes,
    },
    {
      label: "Internos",
      value: dados.totais.internos,
      icon: UserCheck,
      cor: "#eb6834",
      href: hrefDashboard(params, { tipoPessoa: params.tipoPessoa === "interno" ? undefined : "interno" }),
      ativo: params.tipoPessoa === "interno",
    },
    {
      label: "Externos",
      value: dados.totais.externos,
      icon: UserPlus,
      cor: "#e87ba4",
      href: hrefDashboard(params, { tipoPessoa: params.tipoPessoa === "externo" ? undefined : "externo" }),
      ativo: params.tipoPessoa === "externo",
    },
    {
      label: "Nota média",
      value: dados.notaMedia !== null ? dados.notaMedia.toFixed(1) : "-",
      icon: Gauge,
      cor: "#eda100",
    },
    {
      label: "Aprovados",
      value: dados.parecerCount.apto,
      icon: CheckCircle2,
      cor: "#0ca30c",
      href: hrefDashboard(params, { resultado: params.resultado === "apto" ? undefined : "apto" }),
      ativo: params.resultado === "apto",
    },
    {
      label: "Reprovados",
      value: dados.parecerCount.reprovado,
      icon: Ban,
      cor: "#d03b3b",
      href: hrefDashboard(params, { resultado: params.resultado === "reprovado" ? undefined : "reprovado" }),
      ativo: params.resultado === "reprovado",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">Dashboard Executivo</h1>

      <Card size="sm">
        <CardContent>
          <form
            className="grid grid-cols-2 items-end gap-2 sm:grid-cols-4 lg:grid-cols-[repeat(7,minmax(0,1fr))_auto]"
            action="/dashboard"
          >
            {params.resultado ? <input type="hidden" name="resultado" value={params.resultado} /> : null}
            <FilterField label="De">
              <Input type="date" name="dataInicio" defaultValue={params.dataInicio} className="h-8 w-full text-xs" />
            </FilterField>
            <FilterField label="Até">
              <Input type="date" name="dataFim" defaultValue={params.dataFim} className="h-8 w-full text-xs" />
            </FilterField>
            <FilterField label="Tipo">
              <Select items={{ interno: "Interno", externo: "Externo" }} name="tipoPessoa" defaultValue={params.tipoPessoa}>
                <SelectTrigger className="h-8 w-full text-xs">
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
                <SelectTrigger className="h-8 w-full text-xs">
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
                <SelectTrigger className="h-8 w-full text-xs">
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
            <FilterField label="Código">
              <Input name="codigo" defaultValue={params.codigo} placeholder="Matrícula" className="h-8 w-full text-xs" />
            </FilterField>
            <FilterField label="CPF ou Nome">
              <Input name="cpfOuNome" defaultValue={params.cpfOuNome} className="h-8 w-full text-xs" />
            </FilterField>
            <div className="col-span-2 flex gap-1 sm:col-span-1">
              <Button type="submit" size="sm" className="h-8 flex-1">
                Filtrar
              </Button>
              {temFiltroAtivo ? (
                <Button size="sm" variant="ghost" className="h-8" render={<Link href="/dashboard">Limpar</Link>} />
              ) : null}
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        {cards.map((c) => (
          <StatCard key={c.label} {...c} />
        ))}
      </div>

      {dados.totais.falhasCriticas > 0 ? (
        <div className="flex items-center gap-2 rounded-md border border-red-300 bg-red-50 px-4 py-2 text-sm text-red-700">
          <ShieldAlert className="size-4" />
          {dados.totais.falhasCriticas} falha(s) crítica(s) registradas no período filtrado
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <ChartTitle
            icon={Users}
            titulo={`Resultados individuais${params.funcao ? ` — ${params.funcao}` : ""}`}
            subtitulo={`${dados.resultadosIndividuais.length} resultado${dados.resultadosIndividuais.length === 1 ? "" : "s"}, da maior para a menor nota`}
          />
        </CardHeader>
        <CardContent>
          {dados.resultadosIndividuais.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum resultado no período filtrado.</p>
          ) : (
            // Altura de ~10 linhas; o resto fica na rolagem (cabeçalho fixo).
            <div className="max-h-[27rem] overflow-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-muted">
                  <tr className="text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Data</th>
                    <th className="px-3 py-2 font-medium">Nota</th>
                    <th className="px-3 py-2 font-medium">Parecer</th>
                    <th className="px-3 py-2 font-medium">Observação</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.resultadosIndividuais.map((r, i) => (
                    <tr key={i} className="border-t align-top hover:bg-muted/40">
                      <td className="px-3 py-2">
                        <Link href={`/aplicacoes/${r.id}/raiox`} className="font-medium text-primary hover:underline">
                          {r.nome}
                        </Link>
                      </td>
                      <td className="px-3 py-2 capitalize">{r.tipoPessoa}</td>
                      <td className="px-3 py-2">{new Date(r.data + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                      <td className="px-3 py-2 font-semibold">
                        {r.notaGeral !== null ? r.notaGeral.toFixed(1) : "-"}
                      </td>
                      <td className="px-3 py-2">
                        {r.parecerFinal ? <ParecerBadge parecer={r.parecerFinal} /> : "-"}
                      </td>
                      <td className="min-w-48 px-3 py-2 text-xs whitespace-pre-line text-muted-foreground">
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <ChartTitle
              icon={BarChart3}
              titulo="Resultados por avaliação"
              subtitulo="Nota média de cada prova · linha tracejada = média geral"
            />
          </CardHeader>
          <CardContent>
            <BarraNotaMedia data={dados.resultadosPorAvaliacao} mediaGeral={dados.notaMedia} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <ChartTitle
              icon={BarChart3}
              titulo="Nota média por função"
              subtitulo="Agrupado por família e função · linha tracejada = média geral"
            />
          </CardHeader>
          <CardContent>
            <BarraNotaMedia data={dados.notaPorFuncao} mediaGeral={dados.notaMedia} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <ChartTitle
              icon={ListOrdered}
              titulo="Distribuição das notas"
              subtitulo="Quantas avaliações caíram em cada faixa de nota"
            />
          </CardHeader>
          <CardContent>
            <BarraDistribuicao data={dados.distribuicaoNotas} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <ChartTitle
              icon={LineChart}
              titulo="Evolução da nota média"
              subtitulo="Nota média por mês · linha tracejada = média geral"
            />
          </CardHeader>
          <CardContent>
            <LinhaEvolucao data={dados.evolucaoTemporal} mediaGeral={dados.notaMedia} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <ChartTitle
            icon={ShieldAlert}
            titulo="Itens com maior índice de falha crítica"
            subtitulo="Itens críticos que mais reprovaram no período"
          />
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
                  <div className="h-2 w-24 overflow-hidden rounded-full bg-muted sm:w-40">
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
    <div className="flex min-w-0 flex-col gap-0.5">
      <label className="text-[11px] text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ChartTitle({
  icon: Icon,
  titulo,
  subtitulo,
}: {
  icon: typeof Users;
  titulo: string;
  subtitulo: string;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <CardTitle className="text-base">{titulo}</CardTitle>
        <p className="text-xs text-muted-foreground">{subtitulo}</p>
      </div>
    </div>
  );
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

type StatCardProps = {
  label: string;
  value: string | number;
  icon: typeof Users;
  cor: string;
  href?: string;
  ativo?: boolean;
  titulo?: string;
};

function StatCard({ label, value, icon: Icon, cor, href, ativo, titulo }: StatCardProps) {
  const conteudo = (
    <>
      <span
        className="flex size-8 shrink-0 items-center justify-center rounded-md"
        style={{ backgroundColor: `${cor}1f`, color: cor }}
      >
        <Icon className="size-4" />
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] leading-tight text-muted-foreground">{label}</p>
        <p className="text-lg leading-tight font-bold">{value}</p>
      </div>
    </>
  );
  const classe = `flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 transition-colors ${
    ativo ? "ring-2 ring-primary" : ""
  }`;
  if (!href) return <div className={classe}>{conteudo}</div>;
  return (
    <Link
      href={href}
      title={titulo ?? (ativo ? "Clique para tirar o filtro" : `Filtrar: ${label}`)}
      className={`${classe} hover:border-primary/50 hover:bg-muted/40`}
    >
      {conteudo}
    </Link>
  );
}
