"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { atualizarUsuario, excluirUsuario, gerarNovaSenha } from "./actions";
import type { Profile, UserRole } from "@/lib/types";

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Administrador",
  avaliador: "Avaliador",
  recrutamento: "Recrutamento",
  gestor: "Gestor",
};

export function UsuariosTable({ usuarios, meuId }: { usuarios: Profile[]; meuId: string }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            <th className="px-4 py-2 font-medium">Nome</th>
            <th className="px-4 py-2 font-medium">E-mail</th>
            <th className="px-4 py-2 font-medium">Papel</th>
            <th className="px-4 py-2 font-medium">Ativo</th>
            <th className="px-4 py-2 font-medium">Ações</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {usuarios.map((u) => (
            <UsuarioRow key={u.id} usuario={u} isSelf={u.id === meuId} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UsuarioRow({ usuario, isSelf }: { usuario: Profile; isSelf: boolean }) {
  const [pending, startTransition] = useTransition();
  const [senhaGerada, setSenhaGerada] = useState<string | null>(null);

  function mudarRole(role: UserRole) {
    startTransition(async () => {
      const result = await atualizarUsuario(usuario.id, { role });
      if (result.error) toast.error(result.error);
      else toast.success("Papel atualizado");
    });
  }

  function mudarAtivo(ativo: boolean) {
    startTransition(async () => {
      const result = await atualizarUsuario(usuario.id, { ativo });
      if (result.error) toast.error(result.error);
      else toast.success(ativo ? "Usuário reativado" : "Usuário desativado");
    });
  }

  function gerarSenha() {
    if (!confirm(`Gerar uma nova senha pra ${usuario.nome}? A senha atual deixa de funcionar.`)) return;
    startTransition(async () => {
      const result = await gerarNovaSenha(usuario.id);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setSenhaGerada(result.senha ?? null);
    });
  }

  function excluir() {
    if (!confirm(`Excluir o usuário ${usuario.nome}? Essa ação não pode ser desfeita.`)) return;
    startTransition(async () => {
      const result = await excluirUsuario(usuario.id);
      if (result.error) toast.error(result.error);
      else toast.success("Usuário excluído");
    });
  }

  return (
    <tr className="hover:bg-muted/40">
      <td className="px-4 py-2 font-medium">
        {usuario.nome} {isSelf ? <Badge variant="secondary">Você</Badge> : null}
      </td>
      <td className="px-4 py-2 text-muted-foreground">{usuario.email}</td>
      <td className="px-4 py-2">
        <Select
          value={usuario.role}
          onValueChange={(v) => mudarRole(v as UserRole)}
          disabled={pending || isSelf}
        >
          <SelectTrigger className="h-9 w-40">
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
      </td>
      <td className="px-4 py-2">
        <Switch
          checked={usuario.ativo}
          disabled={pending || isSelf}
          onCheckedChange={mudarAtivo}
        />
      </td>
      <td className="px-4 py-2">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={pending} onClick={gerarSenha}>
            Gerar nova senha
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="text-destructive"
            disabled={pending || isSelf}
            onClick={excluir}
          >
            Excluir
          </Button>
        </div>
      </td>

      <Dialog open={senhaGerada !== null} onOpenChange={(o) => !o && setSenhaGerada(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Nova senha gerada</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="text-sm text-muted-foreground">
              Repasse essa senha pra {usuario.nome} por fora do sistema. Ela só aparece agora, não fica
              salva em nenhum lugar.
            </p>
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs">Senha</Label>
              <Input readOnly value={senhaGerada ?? ""} onFocus={(e) => e.target.select()} className="font-mono" />
            </div>
            <Button onClick={() => setSenhaGerada(null)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </tr>
  );
}
