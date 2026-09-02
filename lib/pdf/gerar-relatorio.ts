import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/utils/supabase/server";
import { getAplicacaoRunnerData } from "@/app/(app)/aplicacoes/actions";
import { RelatorioDocument } from "./relatorio-document";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";

/** Gera o buffer do PDF de relatório de uma aplicação. Reaproveitado pela rota de
 * download individual e pela exportação em lote (ZIP). */
export async function gerarRelatorioPdfBuffer(aplicacaoId: string) {
  const [data, config] = await Promise.all([getAplicacaoRunnerData(aplicacaoId), getConfiguracoesPublicas()]);
  if (!data) return null;

  const supabase = await createClient();

  const { data: avaliadorProfile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", data.aplicacao.avaliador_id)
    .single();

  const pessoaNome =
    data.aplicacao.tipo_pessoa === "externo"
      ? (data.aplicacao.candidatos_externos?.nome ?? "Candidato externo")
      : (data.aplicacao.colaborador_snapshot?.nome ?? "-");

  async function signedUrl(path: string | null) {
    if (!path) return null;
    const { data: signed } = await supabase.storage.from("assinaturas").createSignedUrl(path, 60 * 5);
    return signed?.signedUrl ?? null;
  }

  const [assinaturaAvaliadoUrl, assinaturaAvaliadorUrl] = await Promise.all([
    signedUrl(data.aplicacao.assinatura_avaliado_path),
    signedUrl(data.aplicacao.assinatura_avaliador_path),
  ]);

  const alternativasTexto = new Map(data.alternativas.map((a) => [a.id, a.texto]));

  const buffer = await renderToBuffer(
    RelatorioDocument({
      aplicacao: data.aplicacao,
      avaliacaoNome: data.aplicacao.avaliacoes.nome,
      pessoaNome,
      matricula: data.aplicacao.colaborador_snapshot?.matricula ?? "-",
      cargo: data.aplicacao.colaborador_snapshot?.cargo ?? "-",
      estrutura: data.aplicacao.colaborador_snapshot?.estrutura ?? "-",
      possuiCnhInterno: data.aplicacao.colaborador_snapshot?.possui_cnh ?? null,
      categoriaCnhInterno: data.aplicacao.colaborador_snapshot?.categoria_cnh ?? null,
      candidatoExterno: data.aplicacao.candidatos_externos ?? null,
      avaliadorNome: avaliadorProfile?.nome ?? "-",
      secoes: data.secoes,
      perguntas: data.perguntas,
      respostas: data.respostas,
      alternativas: data.alternativas,
      alternativasTexto,
      competencias: data.competencias,
      assinaturaAvaliadoUrl,
      assinaturaAvaliadorUrl,
      logoUrl: config.logoUrl,
      nomeEmpresa: config.nomeEmpresa,
    })
  );

  const matricula = data.aplicacao.colaborador_snapshot?.matricula ?? null;
  const nomeArquivo = `${pessoaNome.replace(/[\\/:*?"<>|]/g, "").trim()} - ${data.aplicacao.avaliacoes.nome}.pdf`;

  return { buffer, matricula, nomeArquivo, pessoaNome };
}
