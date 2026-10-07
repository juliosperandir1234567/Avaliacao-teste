import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { NIVEL_CORES, NIVEL_LABELS, type AnaliseAvaliacao } from "@/lib/analise";

/** Card da análise automática (barras por seção, pontos fortes/a melhorar e parecer). Usado no
 * Raio-X e na tela de finalização, antes da assinatura do avaliador. */
export function AnaliseCard({ analise }: { analise: AnaliseAvaliacao }) {
  if (analise.secoes.length === 0) return null;
  return (
    <Card>
      <CardHeader className="flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">Análise da avaliação</CardTitle>
        {analise.status ? (
          <span className="text-sm font-bold" style={{ color: analise.status.cor }}>
            {analise.status.label}
          </span>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4 text-sm">
        <div className="flex flex-col gap-2">
          {analise.secoes.map((s) => (
            <div key={s.nome} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3">
              <span className="truncate">{s.nome}</span>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${s.percentual}%`, backgroundColor: NIVEL_CORES[s.nivel] }}
                />
              </div>
              <span className="text-right text-xs font-semibold" style={{ color: NIVEL_CORES[s.nivel] }}>
                {s.percentual}% · {NIVEL_LABELS[s.nivel]}
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
          <p className="text-muted-foreground">{analise.parecer}</p>
        </div>
      </CardContent>
    </Card>
  );
}
