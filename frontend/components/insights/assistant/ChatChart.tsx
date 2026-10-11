"use client";

import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

/** Chart description sent by backend/routers/assistant.py: fixed templates (students) or picked from a result's shape (faculty). */
export interface ChartSpec {
  type: "bars" | "line";
  title: string;
  series: string[];
  data: ({ label: string } & Record<string, string | number | null>)[];
}

// Categorical slots 1-4 from the dataviz reference palette (validated; slots 3-4 rely on the legend and table view).
const CATEGORICAL = ["#2a78d6", "#eb6834", "#1baf7a", "#eda100"];
const SINGLE = "#0d8a74"; // validated teal for one-series charts
// Risk tiers keep their meaning as status colours, always shown with a text label.
const STATUS: Record<string, string> = { Red: "#dc2626", Amber: "#d97706", Green: "#059669", "Not assessed": "#94a3b8" };
const AXIS = { fontSize: 11, fill: "#64748b" };

const pretty = (s: string) => s.replace(/_/g, " ");

export function ChatChart({ spec }: { spec: ChartSpec }) {
  const isStatus = spec.series.every((s) => s in STATUS);
  const colour = (s: string, i: number) => (isStatus ? STATUS[s] : spec.series.length === 1 ? SINGLE : CATEGORICAL[i % CATEGORICAL.length]);
  const many = spec.data.length > 8;
  return (
    <figure className="min-w-0 rounded-lg border border-[#e2ebe6] bg-white p-3">
      <figcaption className="mb-2 text-xs font-semibold text-[#172824]">{pretty(spec.title)}</figcaption>
      <div className={many ? "h-64" : "h-52"}>
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "line" ? (
            <LineChart data={spec.data} margin={{ top: 6, right: 10, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#e8efeb" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [v, pretty(n)]} />
              {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} formatter={pretty} />}
              {spec.series.map((s, i) => (
                <Line key={s} type="monotone" dataKey={s} stroke={colour(s, i)} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              ))}
            </LineChart>
          ) : (
            <BarChart data={spec.data} margin={{ top: 6, right: 10, bottom: many ? 40 : 0, left: -18 }}>
              <CartesianGrid stroke="#e8efeb" vertical={false} />
              <XAxis dataKey="label" tick={AXIS} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} interval={0}
                angle={many ? -35 : 0} textAnchor={many ? "end" : "middle"} height={many ? 50 : 24} />
              <YAxis tick={AXIS} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v: number, n: string) => [v, pretty(n)]} cursor={{ fill: "#f1f6f3" }} />
              {spec.series.length > 1 && <Legend wrapperStyle={{ fontSize: 11 }} formatter={pretty} />}
              {spec.series.map((s, i) => (
                <Bar key={s} dataKey={s} fill={colour(s, i)} radius={[4, 4, 0, 0]} maxBarSize={36} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="mt-1 text-xs">
        <summary className="cursor-pointer text-slate-500">Show as a table</summary>
        <div className="mt-1 overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead className="text-slate-500"><tr><th className="py-1 pr-2" /> {spec.series.map((s) => <th key={s} className="pr-2">{pretty(s)}</th>)}</tr></thead>
            <tbody>
              {spec.data.map((d) => (
                <tr key={d.label} className="border-t border-[#eef3f0]">
                  <td className="py-1 pr-2">{d.label}</td>
                  {spec.series.map((s) => <td key={s} className="pr-2">{d[s] ?? "—"}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}
