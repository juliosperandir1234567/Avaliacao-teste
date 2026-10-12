import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MinhaAssinaturaForm } from "@/components/minha-assinatura-form";

export default async function MinhaAssinaturaPage() {
  const profile = await getCurrentProfile();
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("assinatura_path").eq("id", profile.id).single();
  const path = (data?.assinatura_path as string | null) ?? null;
  const { data: signed } = path
    ? await supabase.storage.from("assinaturas").createSignedUrl(path, 60 * 10)
    : { data: null };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-4">
      <h1 className="text-xl font-semibold">Minha assinatura</h1>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Assinatura de {profile.nome}</CardTitle>
        </CardHeader>
        <CardContent>
          <MinhaAssinaturaForm userId={profile.id} assinaturaUrlInicial={signed?.signedUrl ?? null} />
        </CardContent>
      </Card>
    </div>
  );
}
