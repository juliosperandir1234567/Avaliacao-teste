import { notFound } from "next/navigation";
import Link from "next/link";
import { getAplicacaoRunnerData, getSignedUrl, getAuditLog } from "../../actions";
import { getCurrentProfile } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ParecerFinalForm } from "@/components/parecer-final-form";
import { CorrecaoPanel } from "@/components/correcao-panel";
import { PARECER_LABELS, type ChecklistStatus, type Parecer } from "@/lib/types";

export default async function RaioXPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, profile] = await Promise.all([getAplicacaoRunnerData(id), getCurrentProfile()]);
  if (!data) notFound();

  const { aplicacao, perguntas, respostas, competencias } = data;

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
  const editavelParecer =
    profile.role !== "gestor" && profile.role !== "recrutamento" && aplicacao.status === "finalizada";

  const [assinaturaAvaliadoUrl, assinaturaAvaliadorUrl] = await Promise.all([
    aplicacao.assinatura_avaliado_path ? getSignedUrl("assinaturas", aplicacao.assinatura_avaliado_path) : null,
    aplicacao.assinatura_avaliador_path ? getSignedUrl("assinaturas", aplicacao.assinatura_avaliador_path) : null,
  ]);

  const auditLog = profile.role === "admin" ? await getAuditLog(id) : [];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">Raio-X do Avaliado</h1>
          <p className="text-sm text-muted-foreground">{aplicacao.funcao_avaliada}</p>
        </div>
        {aplicacao.status === "finalizada" ? (
          <Button
            variant="outline"
            size="sm"
            render={
              <Link href={`/aplicacoes/${id}/relatorio`} target="_blank">
                Gerar Relatório
              </Link>
            }
          />
        ) : null}
      </div>

      {aplicacao.interrompida_seguranca ? (
        <Alert variant="destructive">
          <AlertTitle>Avaliação interrompida por segurança</AlertTitle>
          <AlertDescription>{aplicacao.motivo_interrupcao}</AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardContent className="grid grid-cols-2 gap-3 pt-4 text-sm">
          <Info label="Nome" value={pessoa?.nome ?? "-"} />
          {aplicacao.tipo_pessoa === "interno" ? (
            <>
              <Info label="Matrícula" value={pessoa && "matricula" in pessoa ? pessoa.matricula : "-"} />
              <Info label="Função" value={pessoa && "cargo" in pessoa ? pessoa.cargo : "-"} />
              <Info label="Estrutura" value={pessoa && "estrutura" in pessoa ? pessoa.estrutura : "-"} />
              <Info
                label="CNH"
                value={
                  aplicacao.colaborador_snapshot?.possui_cnh
                    ? aplicacao.colaborador_snapshot.categoria_cnh || "Sim"
                    : aplicacao.colaborador_snapshot?.possui_cnh === false
                      ? "Não"
                      : "-"
                }
              />
            </>
          ) : (
            <>
              <Info label="Telefone" value={candidatoExterno?.telefone ?? "-"} />
              <Info
                label="CNH"
                value={
                  candidatoExterno?.possui_cnh
                    ? candidatoExterno.categoria_cnh || "Sim"
                    : candidatoExterno?.possui_cnh === false
                      ? "Não"
                      : "-"
                }
              />
              <Info label="Tipo de teste / Função pretendida" value={candidatoExterno?.funcao_pretendida ?? "-"} />
              <Info label="Último emprego" value={candidatoExterno?.empresas_anteriores ?? "-"} />
              {candidatoExterno?.observacoes ? (
                <div className="col-span-2">
                  <Info label="Observações" value={candidatoExterno.observacoes} />
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="items-center text-center">
          <CardTitle className="text-sm font-normal text-muted-foreground">Nota Geral</CardTitle>
          <p className="text-4xl font-bold">
            {aplicacao.nota_geral !== null ? aplicacao.nota_geral.toFixed(1) : "-"}
            <span className="text-lg text-muted-foreground"> / 10</span>
          </p>
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
          <Badge variant="outline">Não avaliados: {checklistStats.nao_avaliado}</Badge>
          <Badge variant={aplicacao.falhas_criticas_count > 0 ? "destructive" : "outline"}>
            Falhas críticas: {aplicacao.falhas_criticas_count}
          </Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Parecer</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="text-sm">
            <span className="text-muted-foreground">Parecer sugerido pelo sistema: </span>
            <span className="font-medium">
              {aplicacao.parecer_sugerido ? PARECER_LABELS[aplicacao.parecer_sugerido as Parecer] : "-"}
            </span>
          </div>
          {aplicacao.status === "finalizada" ? (
            <ParecerFinalForm
              aplicacaoId={id}
              parecerFinal={(aplicacao.parecer_final ?? aplicacao.parecer_sugerido ?? "apto") as Parecer}
              justificativa={aplicacao.parecer_justificativa ?? ""}
              editavel={editavelParecer}
            />
          ) : (
            <p className="text-sm text-muted-foreground">A avaliação ainda não foi finalizada.</p>
          )}
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

      {profile.role === "admin" && aplicacao.status === "finalizada" ? (
        <CorrecaoPanel
          aplicacaoId={id}
          secoes={data.secoes}
          perguntas={perguntas}
          alternativas={data.alternativas}
          respostas={respostas}
          auditLog={auditLog}
        />
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}
