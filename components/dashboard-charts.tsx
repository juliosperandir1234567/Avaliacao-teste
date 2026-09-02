"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
} from "recharts";

const BLUE = "#2a78d6";
const GRID = "#e1e0d9";
const AXIS = "#898781";
const INK = "#0b0b0b";

const tooltipStyle = {
  background: "#fcfcfb",
  border: "1px solid " + GRID,
  borderRadius: 8,
  fontSize: 12,
  color: INK,
};

export function BarraNotaMedia({ data }: { data: { nome: string; notaMedia: number; quantidade: number }[] }) {
  if (data.length === 0) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={Math.max(160, data.length * 34)}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" domain={[0, 10]} stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis type="category" dataKey="nome" stroke={AXIS} fontSize={11} width={140} tickLine={false} axisLine={false} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, _n, item) => [
            `${Number(value).toFixed(1)} (${item.payload.quantidade} avaliações)`,
            "Nota média",
          ]}
        />
        <Bar dataKey="notaMedia" fill={BLUE} radius={[0, 4, 4, 0]} barSize={16}>
          <LabelList
            dataKey="notaMedia"
            position="right"
            fontSize={11}
            fill={INK}
            formatter={(v) => Number(v).toFixed(1)}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function BarraDistribuicao({ data }: { data: { label: string; quantidade: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="label" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v), "Avaliações"]} />
        <Bar dataKey="quantidade" fill={BLUE} radius={[4, 4, 0, 0]} barSize={32}>
          <LabelList dataKey="quantidade" position="top" fontSize={11} fill={INK} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function LinhaEvolucao({ data }: { data: { mes: string; notaMedia: number }[] }) {
  if (data.length === 0) return <EmptyState />;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 16 }}>
        <CartesianGrid vertical={false} stroke={GRID} />
        <XAxis dataKey="mes" stroke={AXIS} fontSize={11} tickLine={false} axisLine={{ stroke: GRID }} />
        <YAxis domain={[0, 10]} stroke={AXIS} fontSize={11} tickLine={false} axisLine={false} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [Number(v).toFixed(1), "Nota média"]} />
        <Line type="monotone" dataKey="notaMedia" stroke={BLUE} strokeWidth={2} dot={{ r: 3, fill: BLUE }} />
      </LineChart>
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
