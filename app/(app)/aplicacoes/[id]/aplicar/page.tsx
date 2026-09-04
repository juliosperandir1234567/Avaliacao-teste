import { notFound, redirect } from "next/navigation";
import { claimPendenciaSeNecessario, getAplicacaoRunnerData } from "../../actions";
import { AplicacaoRunner } from "@/components/aplicacao-runner";
import { getCurrentProfile } from "@/lib/auth";

export default async function AplicarPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await claimPendenciaSeNecessario(id);
  const [data, profile] = await Promise.all([getAplicacaoRunnerData(id), getCurrentProfile()]);
  if (!data) notFound();

  if (data.aplicacao.status === "pendente") {
    redirect("/");
  }

  if (
    data.aplicacao.status === "finalizada" ||
    data.aplicacao.status === "cancelada" ||
    data.aplicacao.status === "aguardando_parecer"
  ) {
    redirect(`/aplicacoes/${id}/raiox`);
  }

  const candidatoExterno = data.aplicacao.candidatos_externos;
  const colaborador = data.aplicacao.colaborador_snapshot;

  const pessoaNome = colaborador?.nome ?? candidatoExterno?.nome ?? "Candidato externo";

  // Gestor não vê as observações prévias do candidato/colaborador enquanto aplica a prova
  // (evita influenciar a avaliação com informação de fora do teste).
  const podeVerObservacoes = profile.role !== "gestor";

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
          ...(podeVerObservacoes && colaborador?.observacoes
            ? [{ label: "Observações", value: colaborador.observacoes }]
            : []),
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
          ...(podeVerObservacoes && candidatoExterno?.observacoes
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
      notaMinima={data.aplicacao.avaliacoes.nota_minima}
      competencias={data.competencias}
    />
  );
}
