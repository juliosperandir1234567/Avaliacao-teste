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

  return (
    <AplicacaoRunner
      aplicacaoId={id}
      tituloAvaliacao={data.aplicacao.avaliacoes.nome}
      secoes={data.secoes}
      perguntas={data.perguntas}
      alternativas={data.alternativas}
      respostasIniciais={data.respostas}
    />
  );
}
