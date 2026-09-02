import { notFound } from "next/navigation";
import Link from "next/link";
import { getAplicacaoRunnerData, getSignedUrl } from "../../actions";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  APLICACAO_STATUS_LABELS,
  PARECER_LABELS,
  type ChecklistStatus,
  type Parecer,
} from "@/lib/types";

export default async function RaioXPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, config] = await Promise.all([
    getAplicacaoRunnerData(id),
    getConfiguracoesPublicas(),
  ]);
  if (!data) notFound();

  const { aplicacao, perguntas, respostas, competencias } = data;

  const supabase = await createClient();
  const { data: avaliadorProfile } = aplicacao.avaliador_id
    ? await supabase.from("profiles").select("nome").eq("id", aplicacao.avaliador_id).single()
    : { data: null };

  const candidatoExterno = aplicacao.candidatos_externos;
  const pessoa =
    aplicacao.tipo_pessoa === "interno"
      ? aplicacao.colaborador_snapshot
      : {
          nome: candidatoExterno?.nome ?? "Candidato externo",
          matricula: "-",
          cargo: candidatoExterno?.funcao_pretendida ?? "-",
          estrutura: "-",
        };

  const respostaPorPergunta = new Map(respostas.map((r) => [r.pergunta_id, r]));
  const checklistPerguntas = perguntas.filter((p) => p.tipo === "checklist");
  const checklistStats = { sim: 0, nao: 0, parcial: 0, nao_avaliado: 0 };
  for (const p of checklistPerguntas) {
    const r = respostaPorPergunta.get(p.id);
    const status = r?.resposta && "status" in r.resposta ? (r.resposta.status as ChecklistStatus) : "nao_avaliado";
    checklistStats[status] += 1;
  }

  const itensAvaliados = respostas.filter((r) => r.pontuacao !== null).length;

  const [assinaturaAvaliadoUrl, assinaturaAvaliadorUrl] = await Promise.all([
    aplicacao.assinatura_avaliado_path ? getSignedUrl("assinaturas", aplicacao.assinatura_avaliado_path) : null,
    aplicacao.assinatura_avaliador_path ? getSignedUrl("assinaturas", aplicacao.assinatura_avaliador_path) : null,
  ]);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      {aplicacao.status === "finalizada" ? (
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/aplicacoes/${id}/relatorio`} target="_blank">
                Gerar Relatório
              </Link>
            }
          />
        </div>
      ) : null}

      {aplicacao.interrompida_seguranca ? (
        <Alert variant="destructive">
          <AlertTitle>Avaliação interrompida por segurança</AlertTitle>
          <AlertDescription>{aplicacao.motivo_interrupcao}</AlertDescription>
        </Alert>
      ) : null}

      <Card className="border-primary/40">
        <CardContent className="flex flex-col gap-3 pt-4 text-sm">
          <div className="flex flex-col items-center gap-2 text-center">
            {config.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={config.logoUrl} alt="" className="h-16 w-16 object-contain" />
            ) : null}
            <div>
              {config.nomeEmpresa ? (
                <p className="text-sm font-semibold text-muted-foreground">{config.nomeEmpresa}</p>
              ) : null}
              <p className="text-base font-bold uppercase">Resultado da Avaliação</p>
              <p className="text-lg font-bold">{aplicacao.avaliacoes.nome}</p>
            </div>
          </div>

          <div className="flex flex-col gap-1 border-t pt-3">
            <FieldLine label="Candidato" value={pessoa?.nome ?? "-"} />
            {aplicacao.tipo_pessoa === "interno" ? (
              <>
                <FieldLine label="Matrícula" value={pessoa && "matricula" in pessoa ? pessoa.matricula : "-"} />
                <FieldLine label="Cargo" value={pessoa && "cargo" in pessoa ? pessoa.cargo : "-"} />
                <FieldLine label="Estrutura" value={pessoa && "estrutura" in pessoa ? pessoa.estrutura : "-"} />
                <FieldLine
                  label="CNH"
                  value={
                    aplicacao.colaborador_snapshot?.possui_cnh
                      ? aplicacao.colaborador_snapshot.categoria_cnh || "Sim"
                      : aplicacao.colaborador_snapshot?.possui_cnh === false
                        ? "Não"
                        : "-"
                  }
                />
                <FieldLine label="Função avaliada" value={aplicacao.funcao_avaliada} />
              </>
            ) : (
              <>
                <FieldLine label="Telefone" value={candidatoExterno?.telefone ?? "-"} />
                <FieldLine
                  label="CNH"
                  value={
                    candidatoExterno?.possui_cnh
                      ? candidatoExterno.categoria_cnh || "Sim"
                      : candidatoExterno?.possui_cnh === false
                        ? "Não"
                        : "-"
                  }
                />
                <FieldLine label="Tipo de teste / Função pretendida" value={candidatoExterno?.funcao_pretendida ?? "-"} />
                <FieldLine label="Último emprego" value={candidatoExterno?.empresas_anteriores ?? "-"} />
                {candidatoExterno?.observacoes ? (
                  <FieldLine label="Observações" value={candidatoExterno.observacoes} />
                ) : null}
              </>
            )}
          </div>

          <div className="flex flex-col gap-1 border-t pt-3">
            <FieldLine label="Avaliador" value={avaliadorProfile?.nome ?? "-"} />
            <FieldLine
              label="Data/Hora"
              value={`${new Date(aplicacao.data).toLocaleDateString("pt-BR")}, ${aplicacao.horario}`}
            />
            <FieldLine label="Situação" value={APLICACAO_STATUS_LABELS[aplicacao.status]} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-center gap-8 text-center">
          <div>
            <CardTitle className="text-sm font-normal text-muted-foreground">Nota Geral</CardTitle>
            <p className="text-4xl font-bold">
              {aplicacao.nota_geral !== null ? aplicacao.nota_geral.toFixed(1) : "-"}
              <span className="text-lg text-muted-foreground"> / 10</span>
            </p>
          </div>
          {aplicacao.parecer_final ? (
            <div>
              <CardTitle className="text-sm font-normal text-muted-foreground">Status</CardTitle>
              <p
                className={`text-xl font-bold ${
                  aplicacao.parecer_final === "apto"
                    ? "text-green-600"
                    : aplicacao.parecer_final === "reprovado" || aplicacao.parecer_final === "nao_recomendado"
                      ? "text-destructive"
                      : ""
                }`}
              >
                {PARECER_LABELS[aplicacao.parecer_final as Parecer]}
              </p>
            </div>
          ) : null}
        </CardHeader>
        {competencias.length > 0 ? (
          <CardContent className="grid grid-cols-2 gap-2 border-t pt-3 text-sm sm:grid-cols-3">
            {competencias.map((c) => {
              const nota = aplicacao.notas_por_competencia?.[c.nome];
              const abaixo = c.nota_minima !== null && nota !== undefined && nota < c.nota_minima;
              return (
                <div key={c.id} className="flex items-center justify-between rounded-md border px-3 py-2">
                  <span className={abaixo ? "text-destructive" : ""}>{c.nome}</span>
                  <span className={`font-semibold ${abaixo ? "text-destructive" : ""}`}>
                    {nota !== undefined ? nota.toFixed(1) : "-"}
                  </span>
                </div>
              );
            })}
          </CardContent>
        ) : null}
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Resumo do checklist</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3 text-sm">
          <span>Itens avaliados: {itensAvaliados}</span>
          <Badge variant="default">Sim: {checklistStats.sim}</Badge>
          {checklistStats.parcial > 0 ? <Badge variant="secondary">Parcial: {checklistStats.parcial}</Badge> : null}
          <Badge variant="destructive">Não: {checklistStats.nao}</Badge>
        </CardContent>
      </Card>

      {assinaturaAvaliadoUrl || assinaturaAvaliadorUrl ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Assinaturas</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-4">
            {assinaturaAvaliadoUrl ? (
              <div className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assinaturaAvaliadoUrl} alt="Assinatura do avaliado" className="h-20 rounded border bg-white" />
                <span className="text-xs text-muted-foreground">Avaliado</span>
              </div>
            ) : null}
            {assinaturaAvaliadorUrl ? (
              <div className="flex flex-col items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={assinaturaAvaliadorUrl} alt="Assinatura do avaliador" className="h-20 rounded border bg-white" />
                <span className="text-xs text-muted-foreground">Avaliador</span>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

function FieldLine({ label, value }: { label: string; value: string }) {
  return (
    <p>
      <span className="text-muted-foreground">{label}: </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}
