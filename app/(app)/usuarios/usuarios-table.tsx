"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { atualizarUsuario } from "./actions";
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
    </tr>
  );
}
