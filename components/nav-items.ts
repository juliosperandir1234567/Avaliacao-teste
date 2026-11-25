import type { UserRole } from "@/lib/types";
import { Home, ClipboardList, UserPlus2, LayoutDashboard, Settings, UserCog } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: typeof Home;
  roles: UserRole[];
  /** Itens de administração/ajustes: aparecem separados, embaixo, menores. */
  secundario?: boolean;
}

// "gestor"/"recrutamento" não são mais usados no dia a dia (só admin e avaliador), mas continuam
// nas listas pra que um usuário antigo com esse papel não fique sem menu.
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Início", icon: Home, roles: ["admin", "avaliador", "gestor", "recrutamento"] },
  {
    href: "/candidatos",
    label: "Candidatos",
    icon: UserPlus2,
    roles: ["admin", "avaliador", "recrutamento"],
  },
  {
    // Exportar fica como botão dentro desta tela (saiu do menu).
    href: "/dashboard",
    label: "Resultados",
    icon: LayoutDashboard,
    roles: ["admin", "avaliador", "recrutamento"],
  },
  {
    href: "/avaliacoes",
    label: "Provas",
    icon: ClipboardList,
    roles: ["admin"],
  },
  {
    href: "/usuarios",
    label: "Usuários",
    icon: UserCog,
    roles: ["admin"],
    secundario: true,
  },
  {
    href: "/configuracoes",
    label: "Configurações",
    icon: Settings,
    // Todos: a assinatura de cada usuário fica aqui (Identidade visual segue só pra admin).
    roles: ["admin", "avaliador", "gestor", "recrutamento"],
    secundario: true,
  },
];

export function navItemsForRole(role: UserRole): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role));
}
