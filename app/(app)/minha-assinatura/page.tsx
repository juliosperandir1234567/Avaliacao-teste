import { redirect } from "next/navigation";

// A assinatura agora fica dentro de Configurações; link antigo continua funcionando.
export default function MinhaAssinaturaPage() {
  redirect("/configuracoes#assinatura");
}
