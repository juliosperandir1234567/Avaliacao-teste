"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { excluirCandidato } from "@/app/(app)/candidatos/actions";

export function ExcluirCandidatoButton({ aplicacaoId, nome }: { aplicacaoId: string; nome: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [senha, setSenha] = useState("");
  const [pending, startTransition] = useTransition();

  function fechar(v: boolean) {
    setOpen(v);
    if (!v) setSenha("");
  }

  function confirmar() {
    if (!senha) return;
    startTransition(async () => {
      const result = await excluirCandidato(aplicacaoId, senha);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Candidato excluído");
      fechar(false);
      router.refresh();
    });
  }

  return (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
      >
        <Trash2 className="size-4 text-destructive" />
      </Button>
      <Dialog open={open} onOpenChange={fechar}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Excluir {nome}?</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Essa ação remove definitivamente a prova/pendência desse candidato e não pode ser
              desfeita. Confirme sua senha de administrador para continuar.
            </p>
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
    </>
  );
}
