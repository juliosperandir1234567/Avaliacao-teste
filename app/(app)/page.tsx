import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { condicaoAtendida } from "@/lib/conditional";
import {
  APLICACAO_STATUS_LABELS,
  type AvaliacaoAplicada,
  type AvaliacaoPergunta,
  type AvaliacaoSecao,
  type Resposta,
} from "@/lib/types";

type AplicacaoResumo = Pick<
  AvaliacaoAplicada,
  | "id"
  | "avaliacao_id"
  | "funcao_avaliada"
  | "status"
  | "data"
  | "tipo_pessoa"
  | "colaborador_snapshot"
  | "parecer_final"
> & {
  candidatos_externos: { nome: string } | { nome: string }[] | null;
};

/** Progresso de uma prova em aberto, por seção. Sem nota: o checklist já vem marcado como Sim,
 * então a nota de uma prova pela metade aparecia 10 antes de o avaliador conferir os itens.
 * A nota só aparece depois de finalizada (Resultados). */
interface Andamento {
  secoesConcluidas: number;
  totalSecoes: number;
}

function primeiro<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function nomePessoa(a: AplicacaoResumo) {
  return a.colaborador_snapshot?.nome ?? primeiro(a.candidatos_externos)?.nome ?? "Candidato externo";
}

export default async function HomePage() {
  const supabase = await createClient();

  // Perfil e lista de pendências em paralelo (antes um esperava o outro).
  const [profile, { data }] = await Promise.all([
    getCurrentProfile(),
    supabase
      .from("avaliacoes_aplicadas")
      .select(
        "id, avaliacao_id, funcao_avaliada, status, data, tipo_pessoa, colaborador_snapshot, parecer_final, candidatos_externos(nome)"
      )
      .not("status", "in", "(finalizada,cancelada)")
      .order("created_at", { ascending: false }),
  ]);
  // Fila em ordem alfabética pelo nome da pessoa (interno vem do snapshot, externo do cadastro).
  const pendencias = ((data ?? []) as AplicacaoResumo[]).sort((a, b) =>
    nomePessoa(a).localeCompare(nomePessoa(b), "pt-BR")
  );

  const andamentoPorAplicacao = await calcularAndamentos(supabase, pendencias);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Olá, {profile.nome.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">
            {pendencias.length === 0
              ? "Nenhuma avaliação pendente."
              : `${pendencias.length} avaliação${pendencias.length > 1 ? "ões" : ""} pendente${pendencias.length > 1 ? "s" : ""}. Toque para aplicar.`}
          </p>
        </div>
        {profile.role === "admin" || profile.role === "avaliador" ? (
          <Link
            href="/candidatos/rapido"
            className="inline-flex h-11 items-center rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            + Nova avaliação
          </Link>
        ) : null}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendências</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {pendencias.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma pendência no momento.</p>
          ) : (
            pendencias.map((a) => <AplicacaoRow key={a.id} a={a} andamento={andamentoPorAplicacao.get(a.id)} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Busca seções, perguntas e respostas de todas as pendências de uma vez (3 consultas no total,
 * não 3 por linha) e calcula quantas seções de cada uma já estão completas. */
async function calcularAndamentos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pendencias: AplicacaoResumo[]
): Promise<Map<string, Andamento>> {
  const resultado = new Map<string, Andamento>();
  if (pendencias.length === 0) return resultado;

  const avaliacaoIds = [...new Set(pendencias.map((a) => a.avaliacao_id))];
  // Seções já trazem as perguntas embutidas -- uma ida ao banco a menos.
  const [{ data: secoesComPerguntas }, { data: respostasData }] = await Promise.all([
    supabase.from("avaliacao_secoes").select("*, avaliacao_perguntas(*)").in("avaliacao_id", avaliacaoIds),
    supabase
      .from("respostas")
      .select("*")
      .in(
        "aplicacao_id",
        pendencias.map((a) => a.id)
      ),
  ]);
  const perguntas: AvaliacaoPergunta[] = [];
  const secoes = (secoesComPerguntas ?? []).map(({ avaliacao_perguntas, ...s }) => {
    perguntas.push(...((avaliacao_perguntas ?? []) as AvaliacaoPergunta[]));
    return s as AvaliacaoSecao;
  });
  const respostas = (respostasData ?? []) as Resposta[];

  const perguntasPorId = new Map(perguntas.map((p) => [p.id, p]));
  for (const a of pendencias) {
    const secoesDela = secoes.filter((s) => s.avaliacao_id === a.avaliacao_id);
    const respostasDela = respostas.filter((r) => r.aplicacao_id === a.id && r.resposta !== null);
    const respostaPorPergunta = new Map(respostasDela.map((r) => [r.pergunta_id, r.resposta]));
    // Mesmas regras do runner: pergunta arquivada só conta se já tiver resposta nesta prova, e
    // pergunta condicional só conta quando a condição foi atendida. Seção sem pergunta visível
    // não entra na conta.
    let totalSecoes = 0;
    let secoesConcluidas = 0;
    for (const secao of secoesDela) {
      const visiveis = perguntas.filter(
        (p) =>
          p.secao_id === secao.id &&
          (!p.arquivada || respostaPorPergunta.has(p.id)) &&
          condicaoAtendida(p, perguntasPorId, respostaPorPergunta)
      );
      if (visiveis.length === 0) continue;
      totalSecoes++;
      if (visiveis.every((p) => respostaPorPergunta.has(p.id))) secoesConcluidas++;
    }
    resultado.set(a.id, { secoesConcluidas, totalSecoes });
  }
  return resultado;
}

function AplicacaoRow({ a, andamento }: { a: AplicacaoResumo; andamento: Andamento | undefined }) {
  const nome = nomePessoa(a);
  const percentual =
    andamento && andamento.totalSecoes > 0
      ? Math.min(100, Math.round((andamento.secoesConcluidas / andamento.totalSecoes) * 100))
      : 0;

  return (
    <Link
      href={`/aplicacoes/${a.id}/aplicar`}
      prefetch={false}
      className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/50"
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="font-medium">
          {nome} — {a.funcao_avaliada}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(a.data).toLocaleDateString("pt-BR")} · {a.tipo_pessoa === "interno" ? "Interno" : "Externo"}
        </span>
        {andamento && andamento.totalSecoes > 0 ? (
          <div className="flex max-w-xs items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percentual}%` }} />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {andamento.secoesConcluidas} de {andamento.totalSecoes} seç{andamento.totalSecoes > 1 ? "ões" : "ão"}
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        <Badge variant="secondary">{APLICACAO_STATUS_LABELS[a.status]}</Badge>
      </div>
    </Link>
  );
}
