import { notFound, redirect } from "next/navigation";
import { edicaoLiberada, getAplicacaoRunnerData } from "../../actions";
import { EditarAplicacaoForm } from "@/components/editar-aplicacao-form";
import type { Parecer } from "@/lib/types";

export default async function EditarAplicacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  // Só admin, e só depois de confirmar a senha no dashboard (cookie de 30 min).
  if (!(await edicaoLiberada(id))) redirect("/dashboard");

  const data = await getAplicacaoRunnerData(id);
  if (!data) notFound();
  if (data.aplicacao.status !== "finalizada") redirect(`/aplicacoes/${id}/raiox`);

  const { aplicacao } = data;
  const pessoaNome =
    aplicacao.colaborador_snapshot?.nome ?? aplicacao.candidatos_externos?.nome ?? "Candidato externo";

  return (
    <EditarAplicacaoForm
      aplicacaoId={id}
      tituloAvaliacao={aplicacao.avaliacoes.nome}
      pessoaNome={pessoaNome}
      secoes={data.secoes}
      perguntas={data.perguntas}
      alternativas={data.alternativas}
      respostasIniciais={data.respostas}
      parecerInicial={(aplicacao.parecer_final as Parecer | null) ?? "apto"}
      observacaoInicial={aplicacao.parecer_justificativa ?? ""}
    />
  );
}
