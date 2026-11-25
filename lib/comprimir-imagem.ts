/**
 * Reduz fotos do celular (muitas vezes 4-8 MB) antes do upload: lado maior até `maxLado` px,
 * JPEG qualidade 0.8. Deixa o envio no campo mais rápido e os PDFs mais leves.
 * Se não for imagem ou algo falhar, devolve o arquivo original (nunca impede o envio).
 */
export async function comprimirImagem(
  file: File,
  maxLado = 1600,
  qualidade = 0.8,
  /** "image/webp" mantém transparência e fica bem menor (fundos); "image/png" pro logo, que vai
   * pro PDF (o gerador de PDF não lê WebP). */
  tipo: "image/jpeg" | "image/webp" | "image/png" = "image/jpeg"
): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif" || file.type === "image/svg+xml") return file;
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const w = Math.round(bitmap.width * escala);
    const h = Math.round(bitmap.height * escala);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, tipo, qualidade));
    // Navegador sem suporte ao formato pedido devolve PNG -- aí mantém o original.
    if (!blob || blob.type !== tipo || blob.size >= file.size) return file;
    const extensao = tipo === "image/webp" ? ".webp" : tipo === "image/png" ? ".png" : ".jpg";
    const nome = file.name.replace(/\.[^.]+$/, "") + extensao;
    return new File([blob], nome, { type: tipo });
  } catch {
    return file;
  }
}
