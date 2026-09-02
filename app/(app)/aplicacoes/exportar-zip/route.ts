import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createClient } from "@/utils/supabase/server";
import { gerarRelatorioPdfBuffer } from "@/lib/pdf/gerar-relatorio";

export async function POST(req: Request) {
  const { ids } = (await req.json()) as { ids?: string[] };
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "Nenhuma avaliação selecionada." }, { status: 400 });
  }

  const zip = new JSZip();
  const usados = new Map<string, number>();

  for (const id of ids) {
    const resultado = await gerarRelatorioPdfBuffer(id);
    if (!resultado) continue;
    const pasta = zip.folder(resultado.matricula || "externos");
    let nome = resultado.nomeArquivo;
    const repetidas = usados.get(nome) ?? 0;
    if (repetidas > 0) nome = nome.replace(/\.pdf$/, ` (${repetidas + 1}).pdf`);
    usados.set(resultado.nomeArquivo, repetidas + 1);
    pasta?.file(nome, resultado.buffer);
  }

  const conteudo = await zip.generateAsync({ type: "nodebuffer" });

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
