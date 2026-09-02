import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getCurrentProfile } from "@/lib/auth";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { APLICACAO_STATUS_LABELS, type AvaliacaoAplicada } from "@/lib/types";

type AplicacaoResumo = Pick<
  AvaliacaoAplicada,
  "id" | "funcao_avaliada" | "status" | "data" | "tipo_pessoa" | "nota_geral" | "colaborador_snapshot" | "parecer_final"
> & { candidatos_externos: { nome: string } | { nome: string }[] | null };

export default async function HomePage() {
  const supabase = await createClient();
  const [profile, config] = await Promise.all([getCurrentProfile(), getConfiguracoesPublicas()]);

  const { data: pendencias } = await supabase
    .from("avaliacoes_aplicadas")
    .select(
      "id, funcao_avaliada, status, data, tipo_pessoa, colaborador_snapshot, nota_geral, parecer_final, candidatos_externos(nome)"
    )
    .not("status", "in", "(finalizada,cancelada)")
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div
      className="-m-4 flex min-h-[calc(100svh-3.5rem)] flex-col gap-6 bg-cover bg-center p-4"
      style={config.backgroundUrl ? { backgroundImage: `url(${config.backgroundUrl})` } : undefined}
    >
      <div>
        <h1 className="text-xl font-semibold">Olá, {profile.nome.split(" ")[0]}</h1>
        <p className="text-sm text-muted-foreground">Fila de pendências de teste.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pendências</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col divide-y">
          {(pendencias ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nenhuma pendência no momento.</p>
          ) : (
            (pendencias as AplicacaoResumo[]).map((a) => <AplicacaoRow key={a.id} a={a} />)
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AplicacaoRow({ a }: { a: AplicacaoResumo }) {
  const candidatoExterno = Array.isArray(a.candidatos_externos) ? a.candidatos_externos[0] : a.candidatos_externos;
  const nome = a.colaborador_snapshot?.nome ?? candidatoExterno?.nome ?? "Candidato externo";
  return (
    <Link
      href={`/aplicacoes/${a.id}/aplicar`}
      prefetch={false}
      className="flex items-center justify-between gap-3 py-3 text-sm hover:bg-muted/50"
    >
      <div className="flex flex-col">
        <span className="font-medium">
          {nome} — {a.funcao_avaliada}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(a.data).toLocaleDateString("pt-BR")} · {a.tipo_pessoa === "interno" ? "Interno" : "Externo"}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {a.nota_geral !== null ? <span className="text-sm font-semibold">{a.nota_geral.toFixed(1)}</span> : null}
        <Badge variant="secondary">{APLICACAO_STATUS_LABELS[a.status]}</Badge>
      </div>
    </Link>
  );
}
