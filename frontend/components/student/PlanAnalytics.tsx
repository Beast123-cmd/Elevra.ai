"use client";

import { Waterfall } from "@/components/shared/charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fmt } from "@/lib/format";
import type { Profile } from "@/lib/types";
import { PILLAR_LABEL } from "./playbook";
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function PlanAnalytics({ profile }: { profile: Profile }) {
  const attendanceWeeks = profile.weekly.filter((week) => week.attendance !== null);
  const semesters = profile.history.filter((entry) => entry.sgpa !== null);
  const attendance = profile.metrics.attendance_pct;
  const attendanceGap = attendance === null || attendance === undefined ? null : attendance - 65;
  const drivers = profile.contributions;
  const strongestLift = drivers.filter((item) => item.points > 0).sort((a, b) => b.points - a.points)[0];
  const strongestDrag = drivers.filter((item) => item.points < 0).sort((a, b) => a.points - b.points)[0];

  return (
    <section aria-labelledby="progress-analytics-heading" className="space-y-3">
      <div>
        <h2 id="progress-analytics-heading" className="text-base font-semibold tracking-tight text-[#172824]">What is shaping your progress?</h2>
        <p className="mt-1 text-xs text-slate-500">See which areas move your score and how attendance is changing through the semester.</p>
      </div>
      <div className="grid items-stretch gap-4 xl:grid-cols-2">
        <Card className="rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
          <CardHeader className="px-4 pb-0 pt-4 sm:px-5">
            <CardTitle className="text-sm text-[#172824]">Why your score differs from the cohort</CardTitle>
            <CardDescription>Weighted contribution points from each assessed area. Above zero lifts your score; below zero pulls it down.</CardDescription>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-1 sm:px-4">
            {drivers.length ? <Waterfall contributions={drivers} /> : <p className="px-3 py-8 text-sm text-slate-500">Score comparisons will appear when enough assessed records are available.</p>}
            {(strongestLift || strongestDrag) && <div className="mx-2 grid gap-2 border-t border-slate-100 pt-3 sm:grid-cols-2">
              {strongestLift && <p className="rounded-lg bg-[#f0f7f3] px-3 py-2 text-xs leading-5 text-slate-700"><span className="font-semibold text-[#23634f]">Helping:</span> {PILLAR_LABEL[strongestLift.pillar]} adds {fmt(strongestLift.points, 1)} points vs cohort.</p>}
              {strongestDrag && <p className="rounded-lg bg-[#faf3ec] px-3 py-2 text-xs leading-5 text-slate-700"><span className="font-semibold text-[#956021]">Room to improve:</span> {PILLAR_LABEL[strongestDrag.pillar]} subtracts {fmt(Math.abs(strongestDrag.points), 1)} points vs cohort.</p>}
            </div>}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02]">
          <CardHeader className="px-4 pb-0 pt-4 sm:px-5">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><CardTitle className="text-sm text-[#172824]">Attendance trend</CardTitle><CardDescription>Weekly attendance against the 65% detention line</CardDescription></div>
              <div className="text-right"><p className="text-2xl font-semibold tabular-nums text-[#172824]">{fmt(attendance, 0, "%")}</p><p className={`text-[10px] font-medium ${attendanceGap !== null && attendanceGap < 0 ? "text-rose-700" : "text-emerald-700"}`}>{attendanceGap === null ? "No current record" : attendanceGap < 0 ? `${fmt(Math.abs(attendanceGap), 0)} pp below line` : `${fmt(attendanceGap, 0)} pp above line`}</p></div>
            </div>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-1 sm:px-4">
            {attendanceWeeks.length ? (
              <>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={attendanceWeeks} margin={{ top: 18, right: 12, bottom: 2, left: 0 }}>
                    <CartesianGrid stroke="#edf1ee" vertical={false} />
                    <XAxis dataKey="week" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(week) => `W${week}`} />
                    <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tickLine={false} axisLine={false} width={34} tick={{ fontSize: 10, fill: "#64748b" }} tickFormatter={(value) => `${value}%`} />
                    <Tooltip formatter={(value) => [`${Number(value).toFixed(1)}%`, "Attendance"]} labelFormatter={(week) => `Week ${week}`} />
                    <ReferenceLine y={65} stroke="#c27730" strokeDasharray="5 4" label={{ value: "65% line", position: "insideTopRight", fill: "#956021", fontSize: 10 }} />
                    <Line type="monotone" dataKey="attendance" name="Attendance" stroke="#286a62" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 3, fill: "#286a62" }} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
                <p className="mx-2 border-t border-slate-100 pt-3 text-xs leading-5 text-slate-600">{attendanceGap === null ? "Overall attendance has not been assessed yet." : attendanceGap < 0 ? `Your overall attendance is ${fmt(Math.abs(attendanceGap), 1)} percentage points below the 65% line. Ask your mentor about support early.` : "Your overall attendance is currently above the 65% line. Keep checking the weekly pattern."}</p>
              </>
            ) : <p className="px-3 py-8 text-sm text-slate-500">Weekly attendance will appear when records are available.</p>}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-[#dce7e1] bg-white shadow-sm shadow-slate-900/[0.02] xl:col-span-2">
          <CardHeader className="px-4 pb-0 pt-4 sm:px-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><div><CardTitle className="text-sm text-[#172824]">Academic progress by semester</CardTitle><CardDescription>Semester GPA from completed terms. Current CGPA shown for context.</CardDescription></div><p className="text-xs text-slate-600">Current CGPA <span className="ml-1 font-semibold tabular-nums text-[#172824]">{fmt(profile.metrics.cgpa, 2)}</span></p></div>
          </CardHeader>
          <CardContent className="px-2 pb-3 pt-1 sm:px-4">
            {semesters.length ? <ResponsiveContainer width="100%" height={200}>
              <LineChart data={semesters} margin={{ top: 14, right: 16, bottom: 2, left: 0 }}>
                <CartesianGrid stroke="#edf1ee" vertical={false} />
                <XAxis dataKey="semester" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#64748b" }} tickFormatter={(semester) => `Sem ${semester}`} />
                <YAxis domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} tickLine={false} axisLine={false} width={30} tick={{ fontSize: 10, fill: "#64748b" }} />
                <Tooltip formatter={(value) => [Number(value).toFixed(2), "Semester GPA"]} labelFormatter={(semester) => `Semester ${semester}`} />
                <Line type="monotone" dataKey="sgpa" name="Semester GPA" stroke="#5474aa" strokeWidth={3} activeDot={{ r: 6 }} dot={{ r: 4, fill: "#5474aa" }} connectNulls />
              </LineChart>
            </ResponsiveContainer> : <p className="px-3 py-8 text-sm text-slate-500">Completed semester GPA records will appear here when available.</p>}
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

