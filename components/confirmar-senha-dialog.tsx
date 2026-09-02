"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ConfirmarSenhaDialog({
  open,
  onOpenChange,
  titulo,
  descricao,
  onConfirm,
  onSuccess,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao: string;
  onConfirm: (senha: string) => Promise<{ error?: string }>;
  onSuccess: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [pending, startTransition] = useTransition();

  function fechar(v: boolean) {
    onOpenChange(v);
    if (!v) setSenha("");
  }

  function confirmar() {
    if (!senha) return;
    startTransition(async () => {
      const result = await onConfirm(senha);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      fechar(false);
      onSuccess();
    });
  }

  return (
    <Dialog open={open} onOpenChange={fechar}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{titulo}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">{descricao}</p>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Sua senha</Label>
            <Input
              type="password"
              autoFocus
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmar();
              }}
            />
          </div>
          <Button variant="destructive" disabled={pending || !senha} onClick={confirmar}>
            {pending ? "Excluindo..." : "Excluir definitivamente"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
