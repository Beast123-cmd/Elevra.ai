"use client";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar,
  RadarChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { PILLARS, type Cohort, type Pillar, type Profile } from "@/lib/types";

const LABELS: Record<Pillar, string> = {
  academic: "Academic", attendance: "Attendance", lms: "LMS Learning", placement: "Placement Readiness",
  skills: "Skills", engagement: "Co-curricular", feedback: "Feedback",
};

/** Why this score? Points each pillar adds or removes versus the cohort average. */
export function Waterfall({ contributions }: { contributions: Profile["contributions"] }) {
  const data = contributions.map((c) => ({ name: LABELS[c.pillar], points: c.points }));
  if (data.length === 0) return <p className="text-sm text-slate-500">No pillar data available.</p>;
  return (
    <ResponsiveContainer width="100%" height={Math.max(220, data.length * 36)}>
      <BarChart data={data} layout="vertical" margin={{ left: 30, right: 16 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis type="number" />
        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 12 }} />
        <ReferenceLine x={0} stroke="#475569" />
        <Tooltip formatter={(v) => `${Number(v) > 0 ? "+" : ""}${Number(v).toFixed(1)} pts vs cohort`} />
        <Bar dataKey="points">
          {data.map((d) => (
            <Cell key={d.name} fill={d.points >= 0 ? "#059669" : "#dc2626"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Student pillar profile against the cohort average. */
export function PillarRadar({ pillars, cohortMeans }: { pillars: Profile["pillars"]; cohortMeans?: Cohort["pillar_means"] }) {
  const data = PILLARS.map((p) => ({
    pillar: LABELS[p].split(" ")[0],
    student: pillars[p] ?? 0,
    cohort: cohortMeans?.[p] ?? null,
  }));
  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data}>
        <PolarGrid />
        <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 11 }} />
        <PolarRadiusAxis domain={[0, 100]} tick={false} />
        {cohortMeans && <Radar dataKey="cohort" name="Cohort average" stroke="#94a3b8" fill="#94a3b8" fillOpacity={0.2} />}
        <Radar dataKey="student" name="Student" stroke="#1e49e2" fill="#1e49e2" fillOpacity={0.35} />
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}

/** LMS activity usually drops before attendance, and attendance before marks. */
export function WeeklyTimeline({ weekly }: { weekly: Profile["weekly"] }) {
  if (weekly.length === 0) return <p className="text-sm text-slate-500">No weekly data yet.</p>;
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={weekly}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="week" label={{ value: "Week", position: "insideBottom", offset: -2, fontSize: 11 }} />
        <YAxis yAxisId="l" />
        <YAxis yAxisId="r" orientation="right" domain={[0, 100]} />
        <Tooltip />
        <Legend />
        <Line yAxisId="l" dataKey="logins" name="LMS logins" stroke="#1e49e2" connectNulls />
        <Line yAxisId="r" dataKey="attendance" name="Attendance %" stroke="#059669" connectNulls />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Score across completed semesters. */
export function HistoryChart({ history }: { history: Profile["history"] }) {
  if (history.length < 2) return <p className="text-sm text-slate-500">Not enough semesters for a trend.</p>;
  return (
    <ResponsiveContainer width="100%" height={180}>
      <LineChart data={history}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="semester" />
        <YAxis domain={[0, 100]} />
        <Tooltip />
        <Line dataKey="score" name="Success score" stroke="#7c3aed" strokeWidth={2} />
      </LineChart>
    </ResponsiveContainer>
  );
}
