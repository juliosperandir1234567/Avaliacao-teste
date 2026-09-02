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
  backgroundUrlInicial,
}: {
  nomeEmpresaInicial: string;
  logoUrlInicial: string | null;
  backgroundUrlInicial: string | null;
}) {
  const router = useRouter();
  const [nomeEmpresa, setNomeEmpresa] = useState(nomeEmpresaInicial);
  const [logoUrl, setLogoUrl] = useState(logoUrlInicial);
  const [backgroundUrl, setBackgroundUrl] = useState(backgroundUrlInicial);
  const [enviandoLogo, setEnviandoLogo] = useState(false);
  const [enviandoFundo, setEnviandoFundo] = useState(false);
  const [pending, startTransition] = useTransition();

  async function uploadImagem(
    file: File,
    prefixo: string,
    campo: "logoPath" | "backgroundPath",
    aplicar: (url: string) => void
  ) {
    const setEnviando = campo === "logoPath" ? setEnviandoLogo : setEnviandoFundo;
    setEnviando(true);
    const supabase = createClient();
    const extensao = file.name.split(".").pop() || "jpg";
    const path = `${prefixo}-${Date.now()}.${extensao}`;
    const { error } = await supabase.storage.from("branding").upload(path, file, {
      upsert: true,
      contentType: file.type || "image/jpeg",
    });
    setEnviando(false);
    if (error) {
      toast.error("Falha ao enviar imagem: " + error.message);
      return;
    }
    const result = await updateConfiguracoes({ [campo]: path });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    const { data } = supabase.storage.from("branding").getPublicUrl(path);
    aplicar(data.publicUrl);
    toast.success("Imagem atualizada");
    router.refresh();
  }

  async function removerFundo() {
    const result = await updateConfiguracoes({ backgroundPath: "" });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setBackgroundUrl(null);
    toast.success("Imagem de fundo removida");
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
            {enviandoLogo ? "Enviando..." : "Trocar imagem"}
            <input
              type="file"
              accept="image/png, image/jpeg, image/jpg, image/webp, image/svg+xml, image/gif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadImagem(file, "logo", "logoPath", setLogoUrl);
              }}
            />
          </label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Imagem de fundo da tela inicial</Label>
        <p className="text-xs text-muted-foreground">Aparece como fundo da tela de Início, atrás do conteúdo.</p>
        <div className="flex items-center gap-4">
          <div className="flex h-20 w-40 items-center justify-center rounded-md border bg-muted/30">
            {backgroundUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={backgroundUrl} alt="Fundo" className="h-full w-full rounded-md object-cover" />
            ) : (
              <span className="text-xs text-muted-foreground">Sem imagem</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm hover:bg-muted/50">
              {enviandoFundo ? "Enviando..." : "Trocar imagem"}
              <input
                type="file"
                accept="image/png, image/jpeg, image/jpg, image/webp, image/gif"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadImagem(file, "fundo", "backgroundPath", setBackgroundUrl);
                }}
              />
            </label>
            {backgroundUrl ? (
              <Button variant="ghost" size="sm" className="text-destructive" onClick={removerFundo}>
                Remover imagem
              </Button>
            ) : null}
          </div>
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
