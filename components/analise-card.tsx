import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NIVEL_CORES, NIVEL_LABELS, type AnaliseAvaliacao, type Consideracao } from "@/lib/analise";
import { ParecerEditavel } from "@/components/parecer-editavel";

/** Card da análise automática (barras por seção, pontos fortes/a melhorar e parecer). Usado no
 * Raio-X e na tela de finalização, antes da assinatura do avaliador. Com `edicao`, o parecer
 * pode ser reescrito; sem, mostra `textoSalvo` (parecer já editado) ou o automático. */
export function AnaliseCard({
  analise,
  edicao,
  textoSalvo = null,
  consideracoes = [],
}: {
  analise: AnaliseAvaliacao;
  edicao?: { aplicacaoId: string; textoSalvo: string | null };
  textoSalvo?: string | null;
  /** "Considerações do avaliador/gestor", mostradas logo abaixo do parecer. */
  consideracoes?: Consideracao[];
}) {
  if (analise.secoes.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Análise da avaliação</CardTitle>
        <div className="flex items-center gap-2.5">
          {analise.nota !== null ? (
            <span
              className="flex items-baseline gap-1 text-2xl font-bold leading-none"
              style={{ color: analise.status?.cor }}
            >
              <span className="text-xs font-medium text-muted-foreground">Nota</span>
              {analise.nota.toFixed(1).replace(".", ",")}
            </span>
          ) : null}
          {analise.status ? (
            <span
              className="rounded-full px-3 py-1 text-sm font-bold"
              style={{ color: analise.status.cor, backgroundColor: `color-mix(in srgb, ${analise.status.cor} 12%, transparent)` }}
            >
              {analise.status.label}
            </span>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        {/* Divergências pra revisão do avaliador (só na tela, não vão pro PDF). */}
        {analise.alertas.map((a) => (
          <p key={a} className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
            ⚠ {a}
          </p>
        ))}
        <div className="flex flex-col gap-2">
          {analise.secoes.map((s) => (
            <div key={s.nome} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
              <span className="truncate">{s.nome}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.percentual}%`, backgroundColor: s.cor ?? NIVEL_CORES[s.nivel] }}
                />
              </div>
              <span className="text-right text-xs font-semibold" style={{ color: s.cor ?? NIVEL_CORES[s.nivel] }}>
                {s.rotulo === "Não avaliada" ? s.rotulo : `${s.percentual}% · ${s.rotulo ?? NIVEL_LABELS[s.nivel]}`}
              </span>
            </div>
          ))}
        </div>

        {analise.pontosFortes.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="font-semibold" style={{ color: NIVEL_CORES.forte }}>
              ✔ Pontos fortes
            </p>
            <ul className="list-disc pl-5">
              {analise.pontosFortes.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </div>
        ) : null}

        {analise.pontosMelhorar.length > 0 ? (
          <div className="flex flex-col gap-1">
            <p className="font-semibold" style={{ color: NIVEL_CORES.atencao }}>
              ✖ Pontos a melhorar
            </p>
            {analise.pontosMelhorar.map((grupo) => (
              <div key={grupo.titulo} className="flex flex-col gap-1">
                <p className="text-xs font-medium text-muted-foreground">{grupo.titulo}</p>
                <div className="flex flex-wrap gap-1">
                  {grupo.itens.map((item, i) => (
                    <span key={i} className="rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs">
                      {item.destaque ? (
                        <span className="font-bold" style={{ color: NIVEL_CORES.atencao }}>
                          {item.destaque}{" "}
                        </span>
                      ) : null}
                      {item.texto}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex flex-col gap-1 border-t pt-3">
          <p className="font-semibold">Parecer</p>
          {edicao ? (
            <ParecerEditavel
              aplicacaoId={edicao.aplicacaoId}
              textoAutomatico={analise.parecer}
              textoSalvo={edicao.textoSalvo}
            />
          ) : (
            <p className="whitespace-pre-line text-muted-foreground">{textoSalvo ?? analise.parecer}</p>
          )}
        </div>

        {consideracoes.map((c) => (
          <div key={c.titulo} className="flex flex-col gap-1 border-t pt-3">
            <p className="font-semibold">{c.titulo}</p>
            <p className="whitespace-pre-line text-muted-foreground">{c.texto}</p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
