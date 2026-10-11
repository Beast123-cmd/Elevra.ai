"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Cohort } from "@/lib/types";

// Categorical slots 1-2 from the dataviz reference palette, validated for colour-blind separation and contrast.
const PASSED = "#2a78d6";
const FAILED = "#eb6834";
const AXIS = { fontSize: 12, fill: "#64748b" };

function Small({ title, unit, data, failedKey, passedKey }: {
  title: string; unit: string; data: Cohort["lead_time"];
  failedKey: "failed_logins" | "failed_attendance"; passedKey: "passed_logins" | "passed_attendance";
}) {
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-sm font-medium">{title}</figcaption>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="week" tick={AXIS} tickLine={false} axisLine={{ stroke: "#cbd5e1" }} tickFormatter={(w) => `W${w}`} />
            <YAxis tick={AXIS} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} unit={unit} />
            <Tooltip
              formatter={(v: number, name: string) => [`${v.toFixed(1)}${unit}`, name]}
              labelFormatter={(w) => `Week ${w}`}
              contentStyle={{ fontSize: 12, borderRadius: 8 }}
            />
            <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey={passedKey} name="Passed later" stroke={PASSED} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
            <Line type="monotone" dataKey={failedKey} name="Failed a subject later" stroke={FAILED} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

export function LeadTimeChart({ data }: { data: Cohort["lead_time"] }) {
  if (data.length === 0) return <p className="text-sm text-slate-500">No weekly data yet.</p>;
  return (
    <div className="space-y-3">
      <div className="grid gap-6 md:grid-cols-2">
        <Small title="LMS logins per week" unit="" data={data} failedKey="failed_logins" passedKey="passed_logins" />
        <Small title="Attendance per week" unit="%" data={data} failedKey="failed_attendance" passedKey="passed_attendance" />
      </div>
      <details className="text-sm">
        <summary className="cursor-pointer text-slate-500">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-left text-xs tabular-nums">
            <thead className="text-slate-500">
              <tr><th className="py-1 pr-3">Week</th><th className="pr-3">Logins: failed</th><th className="pr-3">Logins: passed</th><th className="pr-3">Attendance: failed</th><th>Attendance: passed</th></tr>
            </thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.week} className="border-t">
                  <td className="py-1 pr-3">{r.week}</td><td className="pr-3">{r.failed_logins.toFixed(2)}</td><td className="pr-3">{r.passed_logins.toFixed(2)}</td>
                  <td className="pr-3">{r.failed_attendance.toFixed(1)}%</td><td>{r.passed_attendance.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
