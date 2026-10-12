"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SignaturePad } from "@/components/signature-pad";
import { createClient } from "@/utils/supabase/client";
import { salvarMinhaAssinatura } from "@/app/(app)/minha-assinatura/actions";

/**
 * Recorte automático da imagem anexada: pixels quase brancos viram transparentes e a imagem é
 * cortada no contorno da assinatura -- foto de papel branco fica limpa no PDF.
 */
async function prepararImagem(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * escala);
  const h = Math.round(bitmap.height * escala);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const img = ctx.getImageData(0, 0, w, h);
  const px = img.data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const claro = (px[i] + px[i + 1] + px[i + 2]) / 3;
      if (px[i + 3] < 20 || claro > 200) {
        px[i + 3] = 0;
      } else {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  if (maxX < 0) throw new Error("Não foi encontrada assinatura na imagem (fundo claro e tinta escura).");

  const margem = 8;
  const x0 = Math.max(0, minX - margem);
  const y0 = Math.max(0, minY - margem);
  const cw = Math.min(w, maxX + margem) - x0;
  const ch = Math.min(h, maxY + margem) - y0;
  const recorte = document.createElement("canvas");
  recorte.width = cw;
  recorte.height = ch;
  recorte.getContext("2d")!.drawImage(canvas, x0, y0, cw, ch, 0, 0, cw, ch);
  return new Promise((resolve, reject) =>
    recorte.toBlob((b) => (b ? resolve(b) : reject(new Error("Falha ao processar a imagem."))), "image/png")
  );
}

export function MinhaAssinaturaForm({
  userId,
  assinaturaUrlInicial,
}: {
  userId: string;
  assinaturaUrlInicial: string | null;
}) {
  const [assinaturaUrl, setAssinaturaUrl] = useState<string | null>(assinaturaUrlInicial);
  const [modo, setModo] = useState<"ver" | "desenhar" | "imagem">(assinaturaUrlInicial ? "ver" : "desenhar");
  const [previa, setPrevia] = useState<{ blob: Blob; url: string } | null>(null);
  const [salvando, setSalvando] = useState(false);

  async function salvar(blob: Blob) {
    setSalvando(true);
    const supabase = createClient();
    const path = `usuarios/${userId}/assinatura-${Date.now()}.png`;
    const { error } = await supabase.storage.from("assinaturas").upload(path, blob, { contentType: "image/png" });
    if (error) {
      setSalvando(false);
      toast.error("Falha ao enviar assinatura: " + error.message);
      return;
    }
    const result = await salvarMinhaAssinatura(path);
    setSalvando(false);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    if (previa) URL.revokeObjectURL(previa.url);
    setPrevia(null);
    setAssinaturaUrl(URL.createObjectURL(blob));
    setModo("ver");
    toast.success("Assinatura salva");
  }

  async function anexar(file: File) {
    try {
      const blob = await prepararImagem(file);
      if (previa) URL.revokeObjectURL(previa.url);
      setPrevia({ blob, url: URL.createObjectURL(blob) });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao processar a imagem.");
    }
  }

  return (
    <div className="flex flex-col gap-4 text-sm">
      <p className="text-muted-foreground">
        Usada no botão &quot;Usar minha assinatura&quot; no fim da avaliação, no campo de assinatura do avaliador.
        Trocar a assinatura aqui não altera provas já assinadas.
      </p>

      {modo === "ver" && assinaturaUrl ? (
        <div className="flex flex-col gap-2">
          <Label className="text-xs">Assinatura salva</Label>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={assinaturaUrl} alt="Assinatura salva" className="max-h-36 w-fit rounded-md border bg-white p-2" />
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={modo === "desenhar" ? "default" : "outline"} size="sm" onClick={() => setModo("desenhar")}>
          {assinaturaUrl ? "Trocar desenhando" : "Desenhar"}
        </Button>
        <Button type="button" variant={modo === "imagem" ? "default" : "outline"} size="sm" onClick={() => setModo("imagem")}>
          {assinaturaUrl ? "Trocar por imagem" : "Anexar imagem"}
        </Button>
        {modo !== "ver" && assinaturaUrl ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => setModo("ver")}>
            Cancelar
          </Button>
        ) : null}
      </div>

      {modo === "desenhar" ? (
        <SignaturePad label="Desenhe sua assinatura" captured={false} onCapture={(blob) => salvar(blob)} />
      ) : null}

      {modo === "imagem" ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="assinaturaImagem" className="text-xs">
            Foto ou arquivo da assinatura (de preferência em papel branco, com caneta escura)
          </Label>
          <Input
            id="assinaturaImagem"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="h-10"
            disabled={salvando}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) anexar(file);
            }}
          />
          {previa ? (
            <>
              <Label className="text-xs">Prévia (fundo removido e recortado automaticamente)</Label>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previa.url} alt="Prévia da assinatura" className="max-h-36 w-fit rounded-md border bg-white p-2" />
              <Button type="button" size="sm" className="w-fit" disabled={salvando} onClick={() => salvar(previa.blob)}>
                {salvando ? "Salvando..." : "Salvar esta assinatura"}
              </Button>
            </>
          ) : null}
        </div>
      ) : null}

      {salvando && modo === "desenhar" ? <p className="text-xs text-muted-foreground">Salvando...</p> : null}
    </div>
  );
}
