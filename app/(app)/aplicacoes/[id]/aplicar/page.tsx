import { notFound, redirect } from "next/navigation";
import { claimPendenciaSeNecessario, getAplicacaoRunnerData } from "../../actions";
import { AplicacaoRunner } from "@/components/aplicacao-runner";

export default async function AplicarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await claimPendenciaSeNecessario(id);
  const data = await getAplicacaoRunnerData(id);
  if (!data) notFound();

  if (data.aplicacao.status === "pendente") {
    redirect("/");
  }

  if (data.aplicacao.status === "finalizada" || data.aplicacao.status === "cancelada") {
    redirect(`/aplicacoes/${id}/raiox`);
  }

  const candidatoExterno = data.aplicacao.candidatos_externos;
  const colaborador = data.aplicacao.colaborador_snapshot;

  const pessoaNome = colaborador?.nome ?? candidatoExterno?.nome ?? "Candidato externo";

  const pessoaDetalhes: { label: string; value: string }[] =
    data.aplicacao.tipo_pessoa === "interno"
      ? [
          { label: "Matrícula", value: colaborador?.matricula ?? "-" },
          { label: "Função", value: colaborador?.cargo ?? "-" },
          { label: "Estrutura", value: colaborador?.estrutura ?? "-" },
          {
            label: "CNH",
            value: colaborador?.possui_cnh
              ? colaborador.categoria_cnh || "Sim"
              : colaborador?.possui_cnh === false
                ? "Não"
                : "-",
          },
        ]
      : [
          { label: "Telefone", value: candidatoExterno?.telefone ?? "-" },
          {
            label: "CNH",
            value: candidatoExterno?.possui_cnh
              ? candidatoExterno.categoria_cnh || "Sim"
              : candidatoExterno?.possui_cnh === false
                ? "Não"
                : "-",
          },
          { label: "Último emprego", value: candidatoExterno?.empresas_anteriores ?? "-" },
          ...(candidatoExterno?.observacoes
            ? [{ label: "Observações", value: candidatoExterno.observacoes }]
            : []),
        ];

  return (
    <AplicacaoRunner
      aplicacaoId={id}
      tituloAvaliacao={data.aplicacao.avaliacoes.nome}
      pessoaNome={pessoaNome}
      pessoaDetalhes={pessoaDetalhes}
      secoes={data.secoes}
      perguntas={data.perguntas}
      alternativas={data.alternativas}
      respostasIniciais={data.respostas}
    />
  );
}
