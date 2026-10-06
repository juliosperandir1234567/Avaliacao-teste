import { NextResponse } from "next/server";
import { gerarRelatorioPdfBuffer } from "@/lib/pdf/gerar-relatorio";
import { PARECER_LABELS, type Parecer } from "@/lib/types";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // ?parecer= vem da prévia na tela de finalização: o parecer só é gravado ao finalizar, então a
  // prévia passa o escolhido na tela pro PDF não sair com status vazio.
  const parecerParam = new URL(req.url).searchParams.get("parecer");
  const parecerPrevia = parecerParam && parecerParam in PARECER_LABELS ? (parecerParam as Parecer) : undefined;
  const resultado = await gerarRelatorioPdfBuffer(id, { parecerPrevia });
  if (!resultado) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });

  return new NextResponse(new Uint8Array(resultado.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-${id}.pdf"`,
    },
  });
}
