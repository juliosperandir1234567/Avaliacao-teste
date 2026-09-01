"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

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
  const drawing = useRef(false);
  const hasStroke = useRef(false);
  const [empty, setEmpty] = useState(true);

  function getCtx() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  function pos(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    drawing.current = true;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = getCtx();
    if (!ctx) return;
    const { x, y } = pos(e);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.strokeStyle = "#111827";
    ctx.lineTo(x, y);
    ctx.stroke();
    hasStroke.current = true;
    setEmpty(false);
  }

  function end() {
    drawing.current = false;
  }

  function limpar() {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasStroke.current = false;
    setEmpty(true);
  }

  function confirmar() {
    const canvas = canvasRef.current;
    if (!canvas || !hasStroke.current) return;
    canvas.toBlob((blob) => {
      if (blob) onCapture(blob);
    }, "image/png");
  }

  return (
    <div className="flex flex-col gap-2">
      <Label className="text-xs">{label}</Label>
      {captured ? (
        <p className="rounded-md border border-green-300 bg-green-50 px-3 py-2 text-sm text-green-700">
          Assinatura registrada
        </p>
      ) : (
        <>
          <canvas
            ref={canvasRef}
            width={320}
            height={140}
            className="touch-none rounded-md border bg-white"
            onPointerDown={start}
            onPointerMove={move}
            onPointerUp={end}
            onPointerLeave={end}
          />
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={limpar} disabled={empty}>
              Limpar
            </Button>
            <Button type="button" size="sm" onClick={confirmar} disabled={empty}>
              Confirmar assinatura
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
