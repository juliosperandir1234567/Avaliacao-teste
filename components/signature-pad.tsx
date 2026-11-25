"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type Ponto = { x: number; y: number };

// Celular deitado: pouca altura + orientação paisagem. Nesse caso o campo ocupa a tela inteira.
const MEDIA_PAISAGEM_CELULAR = "(orientation: landscape) and (max-height: 540px)";

/** Campo de assinatura. Os traços ficam guardados (não só os pixels do canvas), então girar o
 * celular -- que muda o tamanho do campo -- não apaga o que já foi assinado. Coordenadas são
 * guardadas divididas pela largura do campo (mesma escala em x e y, sem distorcer). */
export function SignaturePad({
  label,
  onCapture,
  captured,
}: {
  label: string;
  onCapture: (blob: Blob) => void;
  captured: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const tracos = useRef<Ponto[][]>([]);
  const desenhando = useRef(false);
  const [empty, setEmpty] = useState(true);
  const [telaCheia, setTelaCheia] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(MEDIA_PAISAGEM_CELULAR);
    const atualizar = () => setTelaCheia(mq.matches);
    atualizar();
    mq.addEventListener("change", atualizar);
    return () => mq.removeEventListener("change", atualizar);
  }, []);

  function redesenhar() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const largura = canvas.width / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, largura, canvas.height / dpr);
    desenharTracos(ctx, tracos.current, largura, 0, 0, Math.min(4, Math.max(2, (largura / 320) * 2)));
  }

  // Ajusta a resolução do canvas ao tamanho real na tela (e redesenha) sempre que ele muda.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || captured) return;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      redesenhar();
    });
    ro.observe(canvas);
    return () => ro.disconnect();
  }, [captured]);

  // Em tela cheia, trava a rolagem da página por baixo.
  useEffect(() => {
    if (!telaCheia || captured) return;
    const anterior = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = anterior;
    };
  }, [telaCheia, captured]);

  function pos(e: React.PointerEvent<HTMLCanvasElement>): Ponto {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.width };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    desenhando.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
    tracos.current.push([pos(e)]);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!desenhando.current) return;
    tracos.current[tracos.current.length - 1].push(pos(e));
    redesenhar();
    if (empty) setEmpty(false);
  }

  function end() {
    desenhando.current = false;
  }

  function limpar() {
    tracos.current = [];
    redesenhar();
    setEmpty(true);
  }

  function confirmar() {
    const pontos = tracos.current.flat();
    if (pontos.length === 0) return;
    // Recorta só a área assinada (com margem) -- assim a assinatura sai do mesmo tamanho no PDF,
    // tenha sido feita no campo pequeno ou na tela cheia.
    const minX = Math.min(...pontos.map((p) => p.x));
    const maxX = Math.max(...pontos.map((p) => p.x));
    const minY = Math.min(...pontos.map((p) => p.y));
    const maxY = Math.max(...pontos.map((p) => p.y));
    const larguraTracos = Math.max(maxX - minX, 0.01);
    const alturaTracos = Math.max(maxY - minY, 0.01);
    const escala = 600 / Math.max(larguraTracos, alturaTracos * (640 / 280));
    const out = document.createElement("canvas");
    out.width = 640;
    out.height = 280;
    const ctx = out.getContext("2d");
    if (!ctx) return;
    const offX = (out.width - larguraTracos * escala) / 2 - minX * escala;
    const offY = (out.height - alturaTracos * escala) / 2 - minY * escala;
    desenharTracos(ctx, tracos.current, escala, offX, offY, 4);
    out.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/png");
  }

  if (captured) {
    return (
      <div className="flex flex-col gap-2">
        <Label className="text-xs">{label}</Label>
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          Assinatura registrada
        </p>
      </div>
    );
  }

  return (
    <div
      className={
        telaCheia
          ? "fixed inset-0 z-[70] flex flex-col gap-2 bg-background p-3"
          : "flex flex-col gap-2"
      }
    >
      <Label className={telaCheia ? "text-sm" : "text-xs"}>{label}</Label>
      <canvas
        ref={canvasRef}
        className={`touch-none rounded-md border bg-white ${telaCheia ? "min-h-0 w-full flex-1" : "h-40 w-full max-w-md"}`}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      />
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size={telaCheia ? "default" : "sm"} onClick={limpar} disabled={empty}>
          Limpar
        </Button>
        <Button type="button" size={telaCheia ? "default" : "sm"} onClick={confirmar} disabled={empty}>
          Confirmar assinatura
        </Button>
        {!telaCheia ? (
          <span className="text-xs text-muted-foreground md:hidden">Vire o celular para assinar em tela cheia</span>
        ) : null}
      </div>
    </div>
  );
}

function desenharTracos(
  ctx: CanvasRenderingContext2D,
  tracos: Ponto[][],
  escala: number,
  offX: number,
  offY: number,
  espessura: number
) {
  ctx.lineWidth = espessura;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#111827";
  ctx.fillStyle = "#111827";
  for (const traco of tracos) {
    if (traco.length === 0) continue;
    const [p0, ...resto] = traco;
    if (resto.length === 0) {
      ctx.beginPath();
      ctx.arc(p0.x * escala + offX, p0.y * escala + offY, espessura / 2, 0, Math.PI * 2);
      ctx.fill();
      continue;
    }
    ctx.beginPath();
    ctx.moveTo(p0.x * escala + offX, p0.y * escala + offY);
    for (const p of resto) ctx.lineTo(p.x * escala + offX, p.y * escala + offY);
    ctx.stroke();
  }
}
