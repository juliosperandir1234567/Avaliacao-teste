import type { UserRole } from "@/lib/types";
import {
  Home,
  ClipboardList,
  UserPlus2,
  LayoutDashboard,
  Settings,
  UserCog,
  FileDown,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  roles: UserRole[];
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: Home, roles: ["admin", "avaliador", "gestor", "recrutamento"] },
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    roles: ["admin", "avaliador", "recrutamento"],
  },
  {
    href: "/avaliacoes",
    label: "Avaliação",
    icon: ClipboardList,
    roles: ["admin"],
  },
  {
    href: "/candidatos",
    label: "Candidato",
    icon: UserPlus2,
    roles: ["admin", "avaliador", "recrutamento"],
  },
  {
    href: "/usuarios",
    label: "Usuários",
    icon: UserCog,
    roles: ["admin"],
  },
  {
    href: "/dashboard/exportar",
    label: "Exportar",
    icon: FileDown,
    roles: ["admin", "avaliador", "recrutamento"],
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    // Todos: a assinatura de cada usuário fica aqui (Identidade visual segue só pra admin).
    roles: ["admin", "avaliador", "gestor", "recrutamento"],
  },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
