import { notFound } from "next/navigation";
import { getAvaliacaoBuilderData, listEquipamentosTipos } from "../../actions";
import { AvaliacaoBuilder } from "@/components/avaliacao-builder";

export default async function EditarAvaliacaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, equipamentos] = await Promise.all([
    getAvaliacaoBuilderData(id),
    listEquipamentosTipos(),
  ]);

  if (!data) notFound();

  const editavel = data.avaliacao.status === "rascunho" || data.avaliacao.status === "em_revisao";

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-semibold">{data.avaliacao.nome || "Nova avaliação"}</h1>
      <AvaliacaoBuilder
        avaliacaoId={id}
        initial={{ avaliacao: data.avaliacao, competencias: data.competencias, secoes: data.secoes }}
        equipamentos={equipamentos}
        editavel={editavel}
      />
    </div>
  );
}
