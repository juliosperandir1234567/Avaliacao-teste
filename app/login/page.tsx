import { login } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getConfiguracoesPublicas } from "@/lib/configuracoes";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const config = await getConfiguracoesPublicas();

  return (
    <div className="flex min-h-svh flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          {config.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.logoUrl}
              alt={config.nomeEmpresa ?? "Logo"}
              className="mx-auto mb-2 h-14 max-w-48 object-contain"
            />
          ) : null}
          <CardTitle className="text-xl">{config.nomeEmpresa || "Avaliações Técnicas"}</CardTitle>
          <CardDescription>Entre com sua conta para continuar</CardDescription>
        </CardHeader>
        <CardContent>
          <form action={login} className="flex flex-col gap-4">
            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}
            <div className="flex flex-col gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="username"
                required
                className="h-11"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="h-11 mt-2">
              Entrar
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
