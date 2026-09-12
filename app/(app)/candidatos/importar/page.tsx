import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { ImportarCandidatosForm } from "@/components/importar-candidatos-form";

export default async function ImportarCandidatosPage() {
  const profile = await getCurrentProfile();
  if (profile.role === "gestor") redirect("/");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <ImportarCandidatosForm />
    </div>
  );
}
