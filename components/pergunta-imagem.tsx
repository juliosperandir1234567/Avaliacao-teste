"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

export function PerguntaImagem({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    const supabase = createClient();
    supabase.storage
      .from("evidencias")
      .createSignedUrl(path, 300)
      .then(({ data }) => {
        if (ativo && data) setUrl(data.signedUrl);
      });
    return () => {
      ativo = false;
    };
  }, [path]);

  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" className="max-h-64 rounded-md border object-contain" />;
}
