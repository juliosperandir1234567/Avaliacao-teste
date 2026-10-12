"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ReferenceLine,
} from "recharts";

// Paleta validada do skill dataviz (série única = slot 1 azul; texto sempre em tinta neutra).
const BLUE = "#2a78d6";
const GRID = "#e1e0d9";
const AXIS = "#898781";
const INK = "#0b0b0b";
const INK_2 = "#52514e";
const CURSOR = "rgba(42,120,214,0.08)";

const tooltipStyle = {
  background: "#fcfcfb",
  border: "1px solid " + GRID,
  borderRadius: 8,
  fontSize: 12,
  color: INK,
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

function rotuloMedia(media: number) {
  return {
    value: `média ${media.toFixed(1)}`,
    position: "insideTopRight" as const,
    fontSize: 10,
    fill: INK_2,
  };
}

export function BarraNotaMedia({
  data,
  mediaGeral = null,
}: {
  data: { nome: string; notaMedia: number; quantidade: number }[];
  mediaGeral?: number | null;
}) {
  if (data.length === 0) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(170, data.length * 38 + 30)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 36, top: 14 }}>
        <CartesianGrid horizontal={false} stroke={GRID} strokeDasharray="3 3" />
        <XAxis
          type="number"
          domain={[0, 10]}
          ticks={[0, 2, 4, 6, 8, 10]}
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: GRID }}
        />
        <YAxis type="category" dataKey="nome" stroke={AXIS} fontSize={11} width={140} tickLine={false} axisLine={false} />
        <Tooltip
          cursor={{ fill: CURSOR }}
          contentStyle={tooltipStyle}
          formatter={(value, _n, item) => [
            `${Number(value).toFixed(1)} (${item.payload.quantidade} avaliação${item.payload.quantidade === 1 ? "" : "ões"})`,
            "Nota média",
          ]}
        />
        {mediaGeral !== null ? (
          <ReferenceLine x={mediaGeral} stroke={INK_2} strokeDasharray="4 4" label={rotuloMedia(mediaGeral)} />
        ) : null}
        <Bar dataKey="notaMedia" fill={BLUE} radius={[0, 4, 4, 0]} barSize={18}>
          <LabelList
            dataKey="notaMedia"
            position="right"
            fontSize={11}
            fontWeight={600}
            fill={INK}
            formatter={(v) => Number(v).toFixed(1)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarraDistribuicao({ data }: { data: { label: string; quantidade: number }[] }) {
  const total = data.reduce((acc, d) => acc + d.quantidade, 0);
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data} margin={{ top: 18, right: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
        <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} width={28} />
        <Tooltip
          cursor={{ fill: CURSOR }}
          contentStyle={tooltipStyle}
          formatter={(v) => {
            const n = Number(v);
            const pct = total > 0 ? Math.round((n / total) * 100) : 0;
            return [`${n} (${pct}%)`, "Avaliações"];
          }}
        />
        <Bar dataKey="quantidade" fill={BLUE} radius={[4, 4, 0, 0]} maxBarSize={44}>
          <LabelList
            dataKey="quantidade"
            position="top"
            fontSize={11}
            fontWeight={600}
            fill={INK}
            formatter={(v) => (Number(v) > 0 ? Number(v) : "")}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function formatarMes(mes: string) {
  const [ano, m] = mes.split("-");
  const nomes = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  return `${nomes[Number(m) - 1] ?? m}/${ano.slice(2)}`;
}

export function LinhaEvolucao({
  data,
  mediaGeral = null,
}: {
  data: { mes: string; notaMedia: number }[];
  mediaGeral?: number | null;
}) {
  if (data.length === 0) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <AreaChart data={data} margin={{ top: 18, right: 16 }}>
        <defs>
          <linearGradient id="evolucaoFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.25} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke={GRID} strokeDasharray="3 3" />
        <XAxis
          dataKey="mes"
          tickFormatter={formatarMes}
          stroke={AXIS}
          fontSize={11}
          tickLine={false}
          axisLine={{ stroke: GRID }}
        />
        <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} width={28} />
        <Tooltip
          cursor={{ stroke: AXIS, strokeDasharray: "3 3" }}
          contentStyle={tooltipStyle}
          labelFormatter={(l) => formatarMes(String(l))}
          formatter={(v) => [Number(v).toFixed(1), "Nota média"]}
        />
        {mediaGeral !== null ? (
          <ReferenceLine y={mediaGeral} stroke={INK_2} strokeDasharray="4 4" label={rotuloMedia(mediaGeral)} />
        ) : null}
        <Area
          type="monotone"
          dataKey="notaMedia"
          stroke={BLUE}
          strokeWidth={2}
          fill="url(#evolucaoFill)"
          dot={{ r: 4, fill: BLUE, stroke: "#fcfcfb", strokeWidth: 2 }}
          activeDot={{ r: 6, fill: BLUE, stroke: "#fcfcfb", strokeWidth: 2 }}
        >
          <LabelList
            dataKey="notaMedia"
            position="top"
            fontSize={11}
            fontWeight={600}
            fill={INK}
            formatter={(v) => Number(v).toFixed(1)}
          />
        </Area>
      </AreaChart>
    </ResponsiveContainer>
  );
}

function EmptyState() {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
      Sem dados suficientes ainda.
    </div>
  );
}
