"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar,
  RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PILLARS, type Cohort, type Pillar, type Profile } from "@/lib/types";
import { chartChrome, usePalette } from "./palette";

const LABELS: Record<Pillar, string> = {
  academic: "Academic", attendance: "Attendance", lms: "LMS learning", placement: "Placement readiness",
  skills: "Skills", engagement: "Co-curricular", feedback: "Feedback",
};
const legendStyle = { fontSize: 12, paddingTop: 8 };

/** Why this score? Points each pillar adds or removes versus the cohort average. */
export function Waterfall({ contributions }: { contributions: Profile["contributions"] }) {
  const p = usePalette();
  const c = chartChrome(p);
  const data = contributions.map((x) => ({ name: LABELS[x.pillar], points: Math.round(x.points * 10) / 10 }));
  if (data.length === 0) return <p className="text-sm text-muted-foreground">No pillar data available.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 4, right: 40 }}>
        <CartesianGrid {...c.grid} horizontal={false} vertical />
        <XAxis type="number" {...c.axis} />
        <YAxis type="category" dataKey="name" width={130} {...c.axis} tick={{ ...c.axis.tick, fill: p.ink }} />
        <ReferenceLine x={0} stroke={p.muted} />
        <Tooltip {...c.tooltip} formatter={(v) => [`${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(1)} pts vs cohort`, "Effect"]} />
        <Bar isAnimationActive={false} dataKey="points" barSize={16}>
          {data.map((d) => <Cell key={d.name} fill={d.points >= 0 ? p.green : p.brick} />)}
          <LabelList dataKey="points" position="right" formatter={(v: number) => `${v > 0 ? "+" : ""}${v}`} style={{ fill: p.muted, fontSize: 11 }} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Student pillar profile against the cohort average. */
export function PillarRadar({ pillars, cohortMeans }: { pillars: Profile["pillars"]; cohortMeans?: Cohort["pillar_means"] }) {
  const p = usePalette();
  const data = PILLARS.map((k) => ({ pillar: LABELS[k].split(" ")[0], student: pillars[k] ?? 0, cohort: cohortMeans?.[k] ?? null }));
  return (
    <ResponsiveContainer width="100%" height={270}>
      <RadarChart data={data} outerRadius="72%">
        <PolarGrid stroke={p.grid} />
        <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 11, fill: p.muted }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        {cohortMeans && <Radar isAnimationActive={false} dataKey="cohort" name="Cohort average" stroke={p.stone} fill={p.stone} fillOpacity={0.15} strokeDasharray="3 3" />}
        <Radar isAnimationActive={false} dataKey="student" name="This student" stroke={p.primary} fill={p.primary} fillOpacity={0.25} strokeWidth={2} />
        <Legend wrapperStyle={legendStyle} />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** LMS activity usually drops before attendance, and attendance before marks. */
export function WeeklyTimeline({ weekly }: { weekly: Profile["weekly"] }) {
  const p = usePalette();
  const c = chartChrome(p);
  if (weekly.length === 0) return <p className="text-sm text-muted-foreground">No weekly data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={230}>
      <LineChart data={weekly} margin={{ left: -12, right: 0, top: 8 }}>
        <CartesianGrid {...c.grid} />
        <XAxis dataKey="week" {...c.axis} tickFormatter={(w) => `W${w}`} />
        <YAxis yAxisId="l" {...c.axis} width={36} />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} {...c.axis} width={36} />
        <ReferenceLine yAxisId="r" y={65} stroke={p.brick} strokeDasharray="4 4" label={{ value: "65% line", position: "insideTopRight", fill: p.brick, fontSize: 11 }} />
        <Tooltip {...c.tooltip} labelFormatter={(w) => `Week ${w}`} />
        <Legend wrapperStyle={legendStyle} />
        <Line isAnimationActive={false} yAxisId="l" dataKey="logins" name="LMS logins" stroke={p.slate} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
        <Line isAnimationActive={false} yAxisId="r" dataKey="attendance" name="Attendance %" stroke={p.primary} strokeWidth={2} dot={{ r: 2.5 }} connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Score across completed semesters. The axis is fitted to the data so a real change is visible. */
export function HistoryChart({ history }: { history: Profile["history"] }) {
  const p = usePalette();
  const c = chartChrome(p);
  if (history.length < 2) return <p className="text-sm text-muted-foreground">Not enough semesters yet to show a trend.</p>;
  const scores = history.map((h) => h.score);
  const lo = Math.max(0, Math.floor((Math.min(...scores) - 8) / 5) * 5);
  const hi = Math.min(100, Math.ceil((Math.max(...scores) + 8) / 5) * 5);
  return (
    <ResponsiveContainer width="100%" height={190}>
      <LineChart data={history} margin={{ left: -12, right: 24, top: 18 }}>
        <CartesianGrid {...c.grid} />
        <XAxis dataKey="semester" {...c.axis} tickFormatter={(s) => `Sem ${s}`} padding={{ left: 16, right: 16 }} />
        <YAxis domain={[lo, hi]} {...c.axis} width={36} />
        <Tooltip {...c.tooltip} labelFormatter={(s) => `Semester ${s}`} />
        <Line isAnimationActive={false} dataKey="score" name="Success score" stroke={p.primary} strokeWidth={2} dot={{ r: 3.5, fill: p.primary }}>
          <LabelList dataKey="score" position="top" style={{ fill: p.ink, fontSize: 11 }} />
        </Line>
      </LineChart>
    </ResponsiveContainer>
  );
}
