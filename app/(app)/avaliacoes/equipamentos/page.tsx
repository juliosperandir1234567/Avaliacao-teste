import { listEquipamentosTipos } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NovoEquipamentoForm } from "./novo-equipamento-form";

export default async function EquipamentosPage() {
  const equipamentos = await listEquipamentosTipos();
  const porFamilia = new Map<string, typeof equipamentos>();
  for (const eq of equipamentos) {
    const list = porFamilia.get(eq.familia) ?? [];
    list.push(eq);
    porFamilia.set(eq.familia, list);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Famílias de Equipamento</h1>
      <p className="text-sm text-muted-foreground">
        Usadas para carregar perguntas específicas dentro de uma avaliação (ex: Linha Amarela →
        Escavadeira, Pá Carregadeira).
      </p>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo equipamento</CardTitle>
        </CardHeader>
        <CardContent>
          <NovoEquipamentoForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {[...porFamilia.entries()].map(([familia, itens]) => (
            <div key={familia}>
              <p className="text-sm font-medium">{familia}</p>
              <p className="text-sm text-muted-foreground">{itens.map((i) => i.nome).join(", ")}</p>
            </div>
          ))}
          {equipamentos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum equipamento cadastrado.</p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
