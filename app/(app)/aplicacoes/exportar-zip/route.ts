import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/utils/supabase/server";
import { gerarRelatorioPdfBuffer } from "@/lib/pdf/gerar-relatorio";

// Quantos PDFs gerar ao mesmo tempo -- antes era um por vez. 3 acelera bem sem estourar memória.
const PARALELO = 3;

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Nenhuma avaliação selecionada." }, { status: 400 });
  }

  const resultados: Awaited<ReturnType<typeof gerarRelatorioPdfBuffer>>[] = new Array(ids.length);
  let proximo = 0;
  async function trabalhador() {
    while (proximo < ids!.length) {
      const i = proximo++;
      resultados[i] = await gerarRelatorioPdfBuffer(ids![i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(PARALELO, ids.length) }, trabalhador));

  const zip = new JSZip();
  const usados = new Map<string, number>();
  for (const resultado of resultados) {
    if (!resultado) continue;
    const pasta = zip.folder(resultado.matricula || "externos");
    let nome = resultado.nomeArquivo;
    const repetidas = usados.get(nome) ?? 0;
    if (repetidas > 0) nome = nome.replace(/\.pdf$/, ` (${repetidas + 1}).pdf`);
    usados.set(resultado.nomeArquivo, repetidas + 1);
    pasta?.file(nome, resultado.buffer);
  }

  // PDF já vem comprimido; STORE evita gastar CPU recomprimindo à toa.
  const conteudo = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });

  const supabase = await createClient();
  await supabase
    .from("avaliacoes_aplicadas")
    .update({ exportado_em: new Date().toISOString() })
    .in("id", ids);

  return new NextResponse(new Uint8Array(conteudo), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="avaliacoes-${new Date().toISOString().slice(0, 10)}.zip"`,
    },
  });
}
