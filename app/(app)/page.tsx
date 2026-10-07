import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { calcularNotaGeral } from "@/lib/scoring";
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
  | "nota_geral"
  | "colaborador_snapshot"
  | "parecer_final"
> & {
  candidatos_externos: { nome: string } | { nome: string }[] | null;
  avaliacoes: { nota_minima: number } | { nota_minima: number }[] | null;
};

/** Progresso e nota parcial de uma prova em aberto, pra saber de longe como está indo. */
interface Andamento {
  respondidas: number;
  total: number;
  notaParcial: number | null;
  notaMinima: number | null;
}

function primeiro<T>(v: T | T[] | null): T | null {
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

function nomePessoa(a: AplicacaoResumo) {
  return a.colaborador_snapshot?.nome ?? primeiro(a.candidatos_externos)?.nome ?? "Candidato externo";
}

export default async function HomePage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();

  const { data } = await supabase
    .from("avaliacoes_aplicadas")
    .select(
      "id, avaliacao_id, funcao_avaliada, status, data, tipo_pessoa, colaborador_snapshot, nota_geral, parecer_final, candidatos_externos(nome), avaliacoes(nota_minima)"
    )
    .not("status", "in", "(finalizada,cancelada)")
    .order("created_at", { ascending: false });
  // Fila em ordem alfabética pelo nome da pessoa (interno vem do snapshot, externo do cadastro).
  const pendencias = ((data ?? []) as AplicacaoResumo[]).sort((a, b) =>
    nomePessoa(a).localeCompare(nomePessoa(b), "pt-BR")
  );

  const andamentoPorAplicacao = await calcularAndamentos(supabase, pendencias);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Olá, {profile.nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Fila de pendências de teste.</p>
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
 * não 3 por linha) e calcula quantos itens já foram respondidos e a nota parcial de cada uma. */
async function calcularAndamentos(
  supabase: Awaited<ReturnType<typeof createClient>>,
  pendencias: AplicacaoResumo[]
): Promise<Map<string, Andamento>> {
  const resultado = new Map<string, Andamento>();
  if (pendencias.length === 0) return resultado;

  const avaliacaoIds = [...new Set(pendencias.map((a) => a.avaliacao_id))];
  const [{ data: secoesData }, { data: respostasData }] = await Promise.all([
    supabase.from("avaliacao_secoes").select("*").in("avaliacao_id", avaliacaoIds),
    supabase
      .from("respostas")
      .select("*")
      .in(
        "aplicacao_id",
        pendencias.map((a) => a.id)
      ),
  ]);
  const secoes = (secoesData ?? []) as AvaliacaoSecao[];
  const respostas = (respostasData ?? []) as Resposta[];

  const { data: perguntasData } =
    secoes.length > 0
      ? await supabase
          .from("avaliacao_perguntas")
          .select("*")
          .in(
            "secao_id",
            secoes.map((s) => s.id)
          )
      : { data: [] };
  const perguntas = (perguntasData ?? []) as AvaliacaoPergunta[];

  for (const a of pendencias) {
    const secoesDela = secoes.filter((s) => s.avaliacao_id === a.avaliacao_id);
    const secaoIds = new Set(secoesDela.map((s) => s.id));
    const respostasDela = respostas.filter((r) => r.aplicacao_id === a.id && r.resposta !== null);
    const respondidasIds = new Set(respostasDela.map((r) => r.pergunta_id));
    // Mesma regra do runner: pergunta arquivada só conta se já tiver resposta nesta prova.
    const perguntasDela = perguntas.filter(
      (p) => secaoIds.has(p.secao_id) && (!p.arquivada || respondidasIds.has(p.id))
    );
    resultado.set(a.id, {
      respondidas: perguntasDela.filter((p) => respondidasIds.has(p.id)).length,
      total: perguntasDela.length,
      notaParcial: calcularNotaGeral(secoesDela, perguntasDela, respostasDela),
      notaMinima: primeiro(a.avaliacoes)?.nota_minima ?? null,
    });
  }
  return resultado;
}

function AplicacaoRow({ a, andamento }: { a: AplicacaoResumo; andamento: Andamento | undefined }) {
  const nome = nomePessoa(a);
  const nota = andamento?.notaParcial ?? a.nota_geral;
  const notaMinima = andamento?.notaMinima ?? null;
  const corNota =
    nota === null || notaMinima === null ? "" : nota >= notaMinima ? "text-green-600" : "text-destructive";
  const percentual =
    andamento && andamento.total > 0 ? Math.min(100, Math.round((andamento.respondidas / andamento.total) * 100)) : 0;

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
        {andamento && andamento.total > 0 ? (
          <div className="flex max-w-xs items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${percentual}%` }} />
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {andamento.respondidas}/{andamento.total} itens · {percentual}%
            </span>
          </div>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {nota !== null ? (
          <div className="flex flex-col items-end leading-tight">
            <span className="text-[10px] uppercase text-muted-foreground">Nota parcial</span>
            <span className={`text-base font-bold ${corNota}`}>{nota.toFixed(1)}</span>
          </div>
        ) : null}
        <Badge variant="secondary">{APLICACAO_STATUS_LABELS[a.status]}</Badge>
      </div>
    </Link>
  );
}
