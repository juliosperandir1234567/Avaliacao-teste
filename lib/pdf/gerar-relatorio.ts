import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/utils/supabase/server";
import { getAplicacaoRunnerData } from "@/app/(app)/aplicacoes/actions";
import { RelatorioDocument } from "./relatorio-document";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { calcularNotaGeral } from "@/lib/scoring";
import { PARECER_LABELS, type Parecer } from "@/lib/types";

/** Baixa a imagem e converte pra data URI: o Image do @react-pdf/renderer as vezes falha a
 * buscar uma URL remota do storage direto (fetch no runtime do servidor), entao embutir os
 * bytes já resolvidos evita depender disso. */
async function logoComoDataUri(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/png";
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Gera o buffer do PDF de relatório de uma aplicação. Reaproveitado pela rota de
 * download individual e pela exportação em lote (ZIP). */
export async function gerarRelatorioPdfBuffer(aplicacaoId: string) {
  const [data, config] = await Promise.all([getAplicacaoRunnerData(aplicacaoId), getConfiguracoesPublicas()]);
  if (!data) return null;

  const supabase = await createClient();

  const { data: avaliadorProfile } = await supabase
    .from("profiles")
    .select("nome, role")
    .eq("id", data.aplicacao.avaliador_id)
    .single();
  // "Avaliador" no relatório é quem de fato conduziu a prova (coluna avaliador_id) -- mostra o
  // papel certo (Gestor x Avaliador) em vez de sempre chamar de "Avaliador".
  const avaliadorLabel = avaliadorProfile?.role === "gestor" ? "Gestor" : "Avaliador";
  // Quando quem conduziu foi um gestor, mostra também quem aprovou (finalizada_por) como
  // "Avaliador" — os dois nomes ficam visíveis, igual parecer/observação do gestor x avaliador.
  const { data: aprovadorProfile } =
    avaliadorLabel === "Gestor" && data.aplicacao.finalizada_por
      ? await supabase.from("profiles").select("nome").eq("id", data.aplicacao.finalizada_por).single()
      : { data: null };

  const pessoaNome =
    data.aplicacao.tipo_pessoa === "externo"
      ? (data.aplicacao.candidatos_externos?.nome ?? "Candidato externo")
      : (data.aplicacao.colaborador_snapshot?.nome ?? "-");

  async function signedUrl(path: string | null) {
    if (!path) return null;
    const { data: signed } = await supabase.storage.from("assinaturas").createSignedUrl(path, 60 * 5);
    return signed?.signedUrl ?? null;
  }

  const [assinaturaAvaliadoUrl, assinaturaAvaliadorUrl, logoDataUri] = await Promise.all([
    signedUrl(data.aplicacao.assinatura_avaliado_path),
    signedUrl(data.aplicacao.assinatura_avaliador_path),
    logoComoDataUri(config.logoUrl),
  ]);

  // Troca os paths de evidência (bucket "evidencias") por URLs assinadas -- o PDF é gerado sob
  // demanda e as URLs só precisam viver o suficiente pro download, igual assinatura.
  const respostasComEvidencias = await Promise.all(
    data.respostas.map(async (r) => {
      if (r.evidencias.length === 0) return r;
      const urls = await Promise.all(
        r.evidencias.map(async (path) => {
          const { data: signed } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 5);
          return signed?.signedUrl ?? null;
        })
      );
      return { ...r, evidencias: urls.filter((u): u is string => u !== null) };
    })
  );

  const alternativasTexto = new Map(data.alternativas.map((a) => [a.id, a.texto]));

  const buffer = await renderToBuffer(
    RelatorioDocument({
      aplicacao: data.aplicacao,
      avaliacaoNome: data.aplicacao.avaliacoes.nome,
      pessoaNome,
      matricula: data.aplicacao.colaborador_snapshot?.matricula ?? "-",
      cargo: data.aplicacao.colaborador_snapshot?.cargo ?? "-",
      estrutura: data.aplicacao.colaborador_snapshot?.estrutura ?? "-",
      categoriaCnhInterno: data.aplicacao.colaborador_snapshot?.categoria_cnh ?? null,
      observacoesInterno: data.aplicacao.colaborador_snapshot?.observacoes ?? null,
      candidatoExterno: data.aplicacao.candidatos_externos ?? null,
      avaliadorNome: avaliadorProfile?.nome ?? "-",
      avaliadorLabel,
      aprovadorNome: aprovadorProfile?.nome ?? null,
      secoes: data.secoes,
      perguntas: data.perguntas,
      respostas: respostasComEvidencias,
      alternativas: data.alternativas,
      alternativasTexto,
      competencias: data.competencias,
      assinaturaAvaliadoUrl,
      assinaturaAvaliadorUrl,
      logoUrl: logoDataUri,
      nomeEmpresa: config.nomeEmpresa,
    })
  );

  // Nome do arquivo inclui parecer e nota geral -- recalculada aqui (mesma lógica do corpo do
  // PDF em RelatorioDocument) em vez de usar aplicacao.nota_geral direto, pelo mesmo motivo:
  // evitar mostrar um total desatualizado quando uma pergunta foi editada após a prova respondida.
  const notaGeral = calcularNotaGeral(data.secoes, data.perguntas, data.respostas);
  const parecerLabel = data.aplicacao.parecer_final
    ? PARECER_LABELS[data.aplicacao.parecer_final as Parecer]
    : "Sem parecer";
  const notaTexto = notaGeral !== null ? notaGeral.toFixed(2).replace(".", ",") : "-";

  const matricula = data.aplicacao.colaborador_snapshot?.matricula ?? null;
  const nomeArquivo = `${[pessoaNome, parecerLabel, notaTexto, data.aplicacao.avaliacoes.nome]
    .join(" - ")
    .replace(/[\\/:*?"<>|]/g, "")
    .trim()}.pdf`;

  return { buffer, matricula, nomeArquivo, pessoaNome };
}
