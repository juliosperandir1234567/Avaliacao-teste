"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/utils/supabase/client";
import { comprimirImagem } from "@/lib/comprimir-imagem";
import { updateConfiguracoes } from "@/app/(app)/configuracoes/actions";

type Campo = "logoPath" | "backgroundPath" | "menuFundoPath";

/** Como cada imagem é reduzida antes do envio. Os fundos aparecem em toda página (menu) ou no
 * login, então vão em WebP e menores -- antes chegavam a 2 MB cada. O logo fica em PNG porque
 * também vai pro PDF (o gerador de PDF não lê WebP). */
const COMPRESSAO: Record<Campo, { maxLado: number; qualidade: number; tipo: "image/webp" | "image/png" }> = {
  logoPath: { maxLado: 600, qualidade: 0.92, tipo: "image/png" },
  backgroundPath: { maxLado: 1920, qualidade: 0.8, tipo: "image/webp" },
  menuFundoPath: { maxLado: 1000, qualidade: 0.8, tipo: "image/webp" },
};

const PREFIXO: Record<Campo, string> = {
  logoPath: "logo",
  backgroundPath: "fundo",
  menuFundoPath: "menu-fundo",
};

export function ConfiguracoesForm({
  nomeEmpresaInicial,
  logoUrlInicial,
  backgroundUrlInicial,
  menuFundoUrlInicial,
}: {
  nomeEmpresaInicial: string;
  logoUrlInicial: string | null;
  backgroundUrlInicial: string | null;
  menuFundoUrlInicial: string | null;
}) {
  const router = useRouter();
  const [nomeEmpresa, setNomeEmpresa] = useState(nomeEmpresaInicial);
  const [nomeSalvo, setNomeSalvo] = useState(nomeEmpresaInicial);
  const [urls, setUrls] = useState<Record<Campo, string | null>>({
    logoPath: logoUrlInicial,
    backgroundPath: backgroundUrlInicial,
    menuFundoPath: menuFundoUrlInicial,
  });
  const [enviando, setEnviando] = useState<Campo | null>(null);
  const [pending, startTransition] = useTransition();

  async function enviarImagem(campo: Campo, original: File) {
    setEnviando(campo);
    try {
      const { maxLado, qualidade, tipo } = COMPRESSAO[campo];
      const file = await comprimirImagem(original, maxLado, qualidade, tipo);
      const supabase = createClient();
      const extensao = file.name.split(".").pop() || "jpg";
      const path = `${PREFIXO[campo]}-${Date.now()}.${extensao}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, {
        upsert: true,
        contentType: file.type || "image/jpeg",
        cacheControl: "31536000", // nome muda a cada envio, então pode ficar em cache por 1 ano
      });
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
      setUrls((u) => ({ ...u, [campo]: data.publicUrl }));
      toast.success(`Imagem atualizada (${Math.max(1, Math.round(file.size / 1024))} KB)`);
      router.refresh();
    } finally {
      setEnviando(null);
    }
  }

  async function removerImagem(campo: Campo) {
    const result = await updateConfiguracoes({ [campo]: "" });
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setUrls((u) => ({ ...u, [campo]: null }));
    toast.success("Imagem removida");
    router.refresh();
  }

  function salvarNome() {
    startTransition(async () => {
      const result = await updateConfiguracoes({ nomeEmpresa });
      if (result.error) toast.error(result.error);
      else {
        setNomeSalvo(nomeEmpresa);
        toast.success("Nome salvo");
        router.refresh();
      }
    });
  }

  const campoProps = (campo: Campo) => ({
    url: urls[campo],
    enviando: enviando === campo,
    desabilitado: enviando !== null,
    onEnviar: (file: File) => enviarImagem(campo, file),
    onRemover: () => removerImagem(campo),
  });

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold text-muted-foreground">Empresa</h3>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="nomeEmpresa">Nome da empresa</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="nomeEmpresa"
              className="h-10 max-w-sm flex-1"
              value={nomeEmpresa}
              onChange={(e) => setNomeEmpresa(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && nomeEmpresa !== nomeSalvo) salvarNome();
              }}
            />
            <Button disabled={pending || nomeEmpresa === nomeSalvo} onClick={salvarNome}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Aparece no topo do sistema quando não há logo.</p>
        </div>
        <CampoImagem
          titulo="Logo"
          descricao="Menu do sistema, tela de login e relatórios em PDF."
          formato="largo"
          aceita="image/png, image/jpeg, image/webp, image/svg+xml"
          {...campoProps("logoPath")}
        />
      </section>

      <section className="flex flex-col gap-4 border-t pt-5">
        <h3 className="text-sm font-semibold text-muted-foreground">Aparência</h3>
        <CampoImagem
          titulo="Fundo da tela de login"
          descricao="Aparece atrás do card de login. Prefira uma imagem horizontal."
          formato="largo"
          {...campoProps("backgroundPath")}
        />
        <CampoImagem
          titulo="Fundo do menu lateral"
          descricao="Aparece atrás do menu, em todas as páginas. Prefira uma imagem vertical."
          formato="alto"
          {...campoProps("menuFundoPath")}
        />
        <p className="text-xs text-muted-foreground">
          As imagens são reduzidas automaticamente antes do envio, para o sistema carregar mais rápido.
        </p>
      </section>
    </div>
  );
}

function CampoImagem({
  titulo,
  descricao,
  formato,
  aceita = "image/png, image/jpeg, image/webp",
  url,
  enviando,
  desabilitado,
  onEnviar,
  onRemover,
}: {
  titulo: string;
  descricao: string;
  formato: "largo" | "alto";
  aceita?: string;
  url: string | null;
  enviando: boolean;
  desabilitado: boolean;
  onEnviar: (file: File) => void;
  onRemover: () => void;
}) {
  return (
    <div className="flex items-start gap-4">
      <div
        className={`flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/30 ${
          formato === "alto" ? "h-36 w-20" : "h-20 w-36"
        }`}
      >
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={titulo}
            className={titulo === "Logo" ? "max-h-16 max-w-32 object-contain" : "h-full w-full object-cover"}
          />
        ) : (
          <ImageIcon className="size-6 text-muted-foreground/60" />
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1.5">
        <p className="text-sm font-medium">{titulo}</p>
        <p className="text-xs text-muted-foreground">{descricao}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <label
            className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-sm ${
              desabilitado ? "pointer-events-none opacity-60" : "cursor-pointer hover:bg-muted/50"
            }`}
          >
            {enviando ? <Loader2 className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {enviando ? "Enviando..." : url ? "Trocar" : "Enviar imagem"}
            <input
              type="file"
              accept={aceita}
              className="hidden"
              disabled={desabilitado}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) onEnviar(file);
              }}
            />
          </label>
          {url ? (
            <Button variant="ghost" size="sm" className="text-destructive" disabled={desabilitado} onClick={onRemover}>
              <Trash2 className="size-3.5" /> Remover
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
