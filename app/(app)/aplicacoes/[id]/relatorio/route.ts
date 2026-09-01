import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { createClient } from "@/utils/supabase/server";
import { getAplicacaoRunnerData } from "../../actions";
import { RelatorioDocument } from "@/lib/pdf/relatorio-document";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, config] = await Promise.all([getAplicacaoRunnerData(id), getConfiguracoesPublicas()]);
  if (!data) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });

  const supabase = await createClient();

  const { data: avaliadorProfile } = await supabase
    .from("profiles")
    .select("nome")
    .eq("id", data.aplicacao.avaliador_id)
    .single();

  let pessoaNome = "Candidato externo";
  if (data.aplicacao.tipo_pessoa === "externo" && data.aplicacao.candidato_externo_id) {
    const { data: candidato } = await supabase
      .from("candidatos_externos")
      .select("nome")
      .eq("id", data.aplicacao.candidato_externo_id)
      .single();
    if (candidato) pessoaNome = candidato.nome;
  } else if (data.aplicacao.colaborador_snapshot) {
    pessoaNome = data.aplicacao.colaborador_snapshot.nome;
  }

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
      avaliadorNome: avaliadorProfile?.nome ?? "-",
      secoes: data.secoes,
      perguntas: data.perguntas,
      respostas: data.respostas,
      alternativasTexto,
      competencias: data.competencias,
      assinaturaAvaliadoUrl,
      assinaturaAvaliadorUrl,
      logoUrl: config.logoUrl,
      nomeEmpresa: config.nomeEmpresa,
    })
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-${id}.pdf"`,
    },
  });
}
