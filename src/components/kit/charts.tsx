"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Row = Record<string, string | number>;

const axis = { fontSize: 12, fill: "var(--muted-foreground)" };
const tooltip = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--popover-foreground)",
    fontSize: 12,
  },
  cursor: { fill: "var(--muted)", opacity: 0.5 },
};

/** A text alternative so the figures are available without seeing the chart. */
function DataTable({ data, x, y, label }: { data: Row[]; x: string; y: string; label: string }) {
  return (
    <table className="sr-only">
      <caption>{label}</caption>
      <tbody>
        {data.map((row) => (
          <tr key={String(row[x])}>
            <th scope="row">{row[x]}</th>
            <td>{row[y]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function SimpleBarChart({ data, x, y, label, height = 240 }: { data: Row[]; x: string; y: string; label: string; height?: number }) {
  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tooltip} />
            <Bar dataKey={y} name={label} fill="var(--chart-1)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} x={x} y={y} label={label} />
    </figure>
  );
}

export function SimpleLineChart({ data, x, y, label, height = 240 }: { data: Row[]; x: string; y: string; label: string; height?: number }) {
  return (
    <figure>
      <div style={{ height }} aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey={x} tick={axis} tickLine={false} axisLine={false} />
            <YAxis tick={axis} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip {...tooltip} cursor={{ stroke: "var(--border)" }} />
            <Line dataKey={y} name={label} stroke="var(--chart-1)" strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable data={data} x={x} y={y} label={label} />
    </figure>
  );
}
