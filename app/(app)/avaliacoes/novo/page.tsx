import { createAvaliacaoDraft } from "../actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default async function NovaAvaliacaoPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Criar Nova Avaliação</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={createAvaliacaoDraft} className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="nome">Nome da avaliação</Label>
              <Input id="nome" name="nome" required className="h-11" placeholder="Ex: Tratorista" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="funcao">Função avaliada</Label>
              <Input
                id="funcao"
                name="funcao"
                required
                className="h-11"
                placeholder="Ex: Operador de Trator"
              />
            </div>
            <Button type="submit" className="h-11">
              Continuar para o construtor
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
