"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { criarUsuario } from "./actions";
import type { UserRole } from "@/lib/types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  avaliador: "Avaliador",
  recrutamento: "Recrutamento",
  gestor: "Gestor",
};

export function NovoUsuarioForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [role, setRole] = useState<UserRole>("avaliador");
  const [pending, startTransition] = useTransition();

  function salvar() {
    startTransition(async () => {
      const result = await criarUsuario({ nome, email, senha, role });
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Usuário criado");
      setOpen(false);
      setNome("");
      setEmail("");
      setSenha("");
      setRole("avaliador");
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button type="button" />}>+ Novo Usuário</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo Usuário</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label>Nome</Label>
            <Input className="h-10" value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>E-mail</Label>
            <Input
              className="h-10"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Senha provisória</Label>
            <Input
              className="h-10"
              type="text"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Mínimo 6 caracteres"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Papel</Label>
            <Select items={ROLE_LABELS} value={role} onValueChange={(v) => setRole(v as UserRole)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="mt-2"
            disabled={pending || !nome || !email || senha.length < 6}
            onClick={salvar}
          >
            {pending ? "Criando..." : "Criar usuário"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
