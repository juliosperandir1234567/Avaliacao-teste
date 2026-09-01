"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { updateConfiguracoes } from "@/app/(app)/configuracoes/actions";

export function ConfiguracoesForm({
  nomeEmpresaInicial,
  logoUrlInicial,
}: {
  nomeEmpresaInicial: string;
  logoUrlInicial: string | null;
}) {
  const router = useRouter();
  const [nomeEmpresa, setNomeEmpresa] = useState(nomeEmpresaInicial);
  const [logoUrl, setLogoUrl] = useState(logoUrlInicial);
  const [enviando, setEnviando] = useState(false);
  const [pending, startTransition] = useTransition();

  async function uploadLogo(file: File) {
    setEnviando(true);
    const supabase = createClient();
    const path = `logo-${Date.now()}.${file.name.split(".").pop()}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
    setEnviando(false);
    if (error) {
      toast.error("Falha ao enviar imagem: " + error.message);
      return;
    }
    const result = await updateConfiguracoes({ logoPath: path });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    setLogoUrl(data.publicUrl);
    toast.success("Logo atualizada");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Label>Logo da empresa</Label>
        <p className="text-xs text-muted-foreground">
          Aparece no menu do sistema, na tela de login e nos relatórios em PDF.
        </p>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-40 items-center justify-center rounded-md border bg-muted/30">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={logoUrl} alt="Logo" className="max-h-16 max-w-36 object-contain" />
            ) : (
              <span className="text-xs text-muted-foreground">Sem logo</span>
            )}
          </div>
          <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-muted/50">
            {enviando ? "Enviando..." : "Trocar imagem"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadLogo(file);
              }}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="nomeEmpresa">Nome da empresa</Label>
        <div className="flex gap-2">
          <Input
            id="nomeEmpresa"
            className="h-10 max-w-sm"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
          />
          <Button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await updateConfiguracoes({ nomeEmpresa });
                if (result.error) toast.error(result.error);
                else {
                  toast.success("Salvo");
                  router.refresh();
                }
              })
            }
          >
            Salvar
          </Button>
        </div>
      </div>
    </div>
  );
}
