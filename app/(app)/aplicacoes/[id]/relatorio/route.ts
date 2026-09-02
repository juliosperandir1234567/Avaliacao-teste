import { NextResponse } from "next/server";
import { gerarRelatorioPdfBuffer } from "@/lib/pdf/gerar-relatorio";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resultado = await gerarRelatorioPdfBuffer(id);
  if (!resultado) return NextResponse.json({ error: "Avaliação não encontrada" }, { status: 404 });

  return new NextResponse(new Uint8Array(resultado.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="relatorio-${id}.pdf"`,
    },
  });
}
