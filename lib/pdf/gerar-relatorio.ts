import { renderToBuffer } from "@react-pdf/renderer";
import sharp from "sharp";
import { createClient } from "@/utils/supabase/server";
import { getAplicacaoRunnerData } from "@/app/(app)/aplicacoes/actions";
import { RelatorioDocument } from "./relatorio-document";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";
import { calcularNotaGeral } from "@/lib/scoring";
import { PARECER_LABELS, type Parecer } from "@/lib/types";

/** Baixa a imagem e converte pra data URI: o Image do @react-pdf/renderer as vezes falha a
 * buscar uma URL remota do storage direto (fetch no runtime do servidor), entao embutir os
 * bytes já resolvidos evita depender disso. Usado pra logo e foto da CNH -- essa última ficava
 * em branco no PDF vindo direto da URL assinada. */
async function imagemComoDataUri(url: string | null): Promise<string | null> {
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

/** Igual a imagemComoDataUri, mas reduz a foto (celular manda 4-8 MB) pra no máximo `maxLado` px
 * em JPEG -- no PDF ela aparece pequena, então o resto é peso à toa. Era o principal motivo dos
 * PDFs/ZIP lentos e pesados. Se o sharp falhar, usa a imagem original. */
async function fotoOtimizadaDataUri(url: string | null, maxLado = 900): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const original = Buffer.from(await res.arrayBuffer());
    try {
      const reduzida = await sharp(original)
        .rotate() // respeita a orientação EXIF da câmera
        .resize({ width: maxLado, height: maxLado, fit: "inside", withoutEnlargement: true })
        .flatten({ background: "#ffffff" })
        .jpeg({ quality: 72, mozjpeg: true })
        .toBuffer();
      return `data:image/jpeg;base64,${reduzida.toString("base64")}`;
    } catch {
      const contentType = res.headers.get("content-type") || "image/jpeg";
      return `data:${contentType};base64,${original.toString("base64")}`;
    }
  } catch {
    return null;
  }
}

/** Gera o buffer do PDF de relatório de uma aplicação. Reaproveitado pela rota de
 * download individual e pela exportação em lote (ZIP). `parecerPrevia` só vale enquanto a
 * aplicação ainda não tem parecer gravado (prévia antes de finalizar). */
export async function gerarRelatorioPdfBuffer(
  aplicacaoId: string,
  { parecerPrevia }: { parecerPrevia?: Parecer } = {}
) {
  const [data, config] = await Promise.all([getAplicacaoRunnerData(aplicacaoId), getConfiguracoesPublicas()]);
  if (!data) return null;
  if (parecerPrevia && !data.aplicacao.parecer_final) {
    data.aplicacao = { ...data.aplicacao, parecer_final: parecerPrevia };
  }

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

  async function signedUrl(bucket: string, path: string | null) {
    if (!path) return null;
    const { data: signed } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 5);
    return signed?.signedUrl ?? null;
  }

  const [assinaturaAvaliadoUrl, assinaturaAvaliadorUrl, fotoCnhSignedUrl, logoDataUri] = await Promise.all([
    signedUrl("assinaturas", data.aplicacao.assinatura_avaliado_path),
    signedUrl("assinaturas", data.aplicacao.assinatura_avaliador_path),
    signedUrl("evidencias", data.aplicacao.foto_cnh_path),
    imagemComoDataUri(config.logoUrl),
  ]);
  // Troca os paths de evidência (bucket "evidencias") por fotos já reduzidas (data URI) -- antes
  // ia a URL da foto original e o PDF embutia a imagem inteira do celular.
  const [fotoCnhUrl, respostasComEvidencias] = await Promise.all([
    fotoOtimizadaDataUri(fotoCnhSignedUrl),
    Promise.all(
    data.respostas.map(async (r) => {
      if (r.evidencias.length === 0) return r;
      const urls = await Promise.all(
        r.evidencias.map(async (path) => {
          const { data: signed } = await supabase.storage.from("evidencias").createSignedUrl(path, 60 * 5);
          return fotoOtimizadaDataUri(signed?.signedUrl ?? null, 700);
        })
      );
      return { ...r, evidencias: urls.filter((u): u is string => u !== null) };
    })
    ),
  ]);

  const alternativasTexto = new Map(data.alternativas.map((a) => [a.id, a.texto]));

  const buffer = await renderToBuffer(
    RelatorioDocument({
      aplicacao: data.aplicacao,
      avaliacaoNome: data.aplicacao.avaliacoes.nome,
      pessoaNome,
      matricula: data.aplicacao.colaborador_snapshot?.matricula ?? "-",
      cargo: data.aplicacao.colaborador_snapshot?.cargo ?? "-",
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
      fotoCnhUrl,
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
