"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, ZAxis,
} from "recharts";
import { EmptyState, Kpi } from "@/components/shared/Kpi";
import { Card } from "@/components/ui/card";
import { BAND_COLOR, SEGMENT_COLOR } from "@/lib/format";
import { PILLARS, type Insight } from "@/lib/types";
import {
  applyFilters, bandDistribution, filterOptions, heatmapByDepartment, kpis, quadrantPoints, riskBy, type OverviewRow,
} from "./aggregate";

const PILLAR_SHORT: Record<string, string> = {
  academic: "Academic", attendance: "Attendance", lms: "LMS", placement: "Placement", skills: "Skills", engagement: "Co-curr.", feedback: "Feedback",
};
const SELECT = "h-9 rounded-md border border-slate-300 bg-white px-2 text-sm";

function heat(v: number | null) {
  if (v === null) return "#f1f5f9";
  const t = Math.max(0, Math.min(1, (v - 30) / 60));
  return `hsl(${Math.round(t * 140)}, 70%, ${92 - t * 22}%)`;
}

function RiskBars({ data }: { data: ReturnType<typeof riskBy> }) {
  return (
    <ResponsiveContainer width="100%" height={230}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="group" />
        <YAxis allowDecimals={false} />
        <Tooltip />
        <Legend />
        <Bar isAnimationActive={false} dataKey="Red" stackId="r" fill="#dc2626" />
        <Bar isAnimationActive={false} dataKey="Amber" stackId="r" fill="#f59e0b" />
        <Bar isAnimationActive={false} dataKey="Green" stackId="r" fill="#10b981" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AdminOverview({ rows, insights = [] }: { rows: OverviewRow[]; insights?: Insight[] }) {
  const router = useRouter();
  const [filters, setFilters] = useState({ department: "All", year: "All", batch: "All" });
  const opts = useMemo(() => filterOptions(rows), [rows]);
  const view = useMemo(() => applyFilters(rows, filters), [rows, filters]);
  const k = useMemo(() => kpis(view), [view]);
  const dist = useMemo(() => bandDistribution(view), [view]);
  const byDept = useMemo(() => riskBy(view, "department"), [view]);
  const byYear = useMemo(() => riskBy(view, "year"), [view]);
  const points = useMemo(() => quadrantPoints(view), [view]);
  const heatmap = useMemo(() => heatmapByDepartment(view), [view]);

  const filterSelect = (key: keyof typeof filters, label: string, values: string[]) => (
    <label className="text-xs text-slate-500">
      {label}
      <select className={`${SELECT} mt-1 block`} value={filters[key]} onChange={(e) => setFilters({ ...filters, [key]: e.target.value })}>
        <option>All</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-4">
        <div className="mr-auto">
          <h1 className="text-2xl font-bold">Institution overview</h1>
          <p className="text-sm text-slate-500">7 integrated data sources · scores refreshed weekly · click a dot to open a student</p>
        </div>
        {filterSelect("department", "Department", opts.departments)}
        {filterSelect("year", "Year", opts.years)}
        {filterSelect("batch", "Batch", opts.batches)}
      </div>

      {view.length === 0 ? (
        <EmptyState>No students match these filters. Try clearing one.</EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Students" value={k.students.toLocaleString()} />
            <Kpi label="Avg success score" value={k.avgScore?.toFixed(1) ?? "—"} />
            <Kpi label="Academic risk: Red" value={`${k.academicRedPct}%`} hint="needs a check-in" />
            <Kpi label="Placement risk: Red" value={`${k.placementRedPct}%`} hint="3rd & 4th years assessed" />
            <Kpi label="Placement-ready" value={k.placementReadyPct === null ? "—" : `${k.placementReadyPct}%`} hint="readiness ≥ 70" />
          </div>

          {insights.length > 0 && (
            <div className="grid gap-3 lg:grid-cols-3">
              {insights.slice(0, 3).map((i) => (
                <Card key={i.id} className={`p-4 ${i.severity === "critical" ? "border-red-200" : i.severity === "warning" ? "border-amber-200" : ""}`}>
                  <div className="text-xs font-semibold uppercase text-slate-500">Insight</div>
                  <div className="mt-1 font-semibold">{i.title}</div>
                  <p className="mt-1 text-sm text-slate-600">{i.detail}</p>
                </Card>
              ))}
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Success score bands</h2>
              <p className="mb-2 text-xs text-slate-500">{k.earlyWarning} students show an early-warning LMS drop</p>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={dist}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="band" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Bar isAnimationActive={false} dataKey="count" name="Students">
                    {dist.map((d) => (
                      <Cell key={d.band} fill={BAND_COLOR[d.band]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Academic vs placement readiness</h2>
              <p className="mb-2 text-xs text-slate-500">3rd & 4th years. Top-left dots are strong academically but not placement-ready.</p>
              {points.length === 0 ? (
                <EmptyState>No assessed students in this selection.</EmptyState>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <ScatterChart margin={{ left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" dataKey="x" name="Academic" domain={[0, 100]} />
                    <YAxis type="number" dataKey="y" name="Placement" domain={[0, 100]} />
                    <ZAxis range={[28, 28]} />
                    <Tooltip
                      content={({ payload }) =>
                        payload?.[0] ? (
                          <div className="rounded border bg-white p-2 text-xs shadow">
                            {payload[0].payload.name}
                            <br />
                            {payload[0].payload.segment}
                          </div>
                        ) : null
                      }
                    />
                    <Scatter isAnimationActive={false} data={points} onClick={(d: { id?: string; payload?: { id: string } }) => router.push(`/faculty/student/${d.payload?.id ?? d.id}`)}>
                      {points.map((p) => (
                        <Cell key={p.id} fill={SEGMENT_COLOR[p.segment] ?? "#64748b"} cursor="pointer" />
                      ))}
                    </Scatter>
                  </ScatterChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Academic risk by department</h2>
              <RiskBars data={byDept} />
            </Card>
            <Card className="p-4">
              <h2 className="text-sm font-semibold">Academic risk by year</h2>
              <RiskBars data={byYear} />
            </Card>
          </div>

          <Card className="p-4">
            <h2 className="text-sm font-semibold">Department × pillar heatmap</h2>
            <p className="mb-2 text-xs text-slate-500">Average pillar score (0–100). Students with no data for a pillar are left out of its average.</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="p-1 text-left">Dept</th>
                    {PILLARS.map((p) => (
                      <th key={p} className="p-1">{PILLAR_SHORT[p]}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {heatmap.map((h) => (
                    <tr key={h.department}>
                      <td className="p-1 font-medium">{h.department}</td>
                      {PILLARS.map((p) => (
                        <td key={p} className="p-1 text-center" style={{ background: heat(h[p]) }}>
                          {h[p] === null ? "—" : h[p]?.toFixed(0)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
