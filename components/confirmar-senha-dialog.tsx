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
  labelAcao = "Excluir definitivamente",
  labelPendente = "Excluindo...",
  variant = "destructive",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titulo: string;
  descricao: string;
  onConfirm: (emailAdmin: string, senha: string) => Promise<{ error?: string }>;
  onSuccess: () => void;
  labelAcao?: string;
  labelPendente?: string;
  variant?: "destructive" | "default";
}) {
  const [emailAdmin, setEmailAdmin] = useState("");
  const [senha, setSenha] = useState("");
  const [pending, startTransition] = useTransition();

  function fechar(v: boolean) {
    onOpenChange(v);
    if (!v) {
      setEmailAdmin("");
      setSenha("");
    }
  }

  function confirmar() {
    if (!emailAdmin || !senha) return;
    startTransition(async () => {
      const result = await onConfirm(emailAdmin, senha);
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
            <Label className="text-xs">E-mail do administrador</Label>
            <Input
              type="email"
              autoFocus
              value={emailAdmin}
              onChange={(e) => setEmailAdmin(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs">Senha do administrador</Label>
            <Input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") confirmar();
              }}
            />
          </div>
          <Button variant={variant} disabled={pending || !emailAdmin || !senha} onClick={confirmar}>
            {pending ? labelPendente : labelAcao}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
