"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BandBadge, RiskBadge } from "@/components/shared/badges";
import { EmptyState } from "@/components/shared/Kpi";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { filterQueue, readContacted, toCsv, topReasons, writeContacted, type QueueFilters, type QueueRow } from "./queue";

const FIELD = "mt-1 block h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm";
const SHOW_MAX = 200;

function download(name: string, text: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type: "text/csv" }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function ActionQueue({ rows, showMentorFilter }: { rows: QueueRow[]; showMentorFilter: boolean }) {
  const [f, setF] = useState<QueueFilters>({ q: "", year: "All", risk: "Any", segment: "All", mentor: "All", hideContacted: false });
  const [ticks, setTicks] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const s = readContacted(window.localStorage);
    setTicks(Object.fromEntries(Array.from(s).map((id) => [id, true])));
  }, []);

  const contacted = useMemo(() => new Set(Object.keys(ticks).filter((k) => ticks[k])), [ticks]);
  const shown = useMemo(() => filterQueue(rows, f, contacted), [rows, f, contacted]);
  const uniq = (xs: (string | null)[]) => Array.from(new Set(xs.filter((x): x is string => !!x))).sort();
  const years = uniq(rows.map((r) => String(r.year)));
  const segments = uniq(rows.map((r) => r.segment));
  const mentors = uniq(rows.map((r) => r.mentor_faculty_id));

  function toggle(id: string, on: boolean) {
    const next = { ...ticks, [id]: on };
    setTicks(next);
    writeContacted(window.localStorage, next);
  }

  const select = (key: "year" | "segment" | "mentor", label: string, values: string[]) => (
    <label className="text-xs text-slate-500">
      {label}
      <select className={FIELD} value={f[key]} onChange={(e) => setF({ ...f, [key]: e.target.value })}>
        <option>All</option>
        {values.map((v) => (
          <option key={v}>{v}</option>
        ))}
      </select>
    </label>
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Action Queue</h1>
        <p className="text-sm text-slate-500">
          Ranked by priority: who to contact this week, why, and what to do. Flags are prompts for a conversation, not judgements.
        </p>
      </div>

      <Card className="p-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
          <label className="col-span-2 text-xs text-slate-500">
            Search
            <input className={FIELD} placeholder="Name or student id" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} />
          </label>
          {select("year", "Year", years)}
          <label className="text-xs text-slate-500">
            Risk
            <select className={FIELD} value={f.risk} onChange={(e) => setF({ ...f, risk: e.target.value as QueueFilters["risk"] })}>
              {["Any", "Academic Red", "Placement Red", "Early warning"].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
          </label>
          {select("segment", "Segment", segments)}
          {showMentorFilter && select("mentor", "Mentor", mentors)}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={f.hideContacted} onChange={(e) => setF({ ...f, hideContacted: e.target.checked })} />
            Hide contacted
          </label>
          <span className="text-slate-500">{shown.length} students</span>
          <Button className="ml-auto" size="sm" disabled={shown.length === 0} onClick={() => download("action-queue.csv", toCsv(shown))}>
            Export CSV
          </Button>
        </div>
      </Card>

      {shown.length === 0 ? (
        <EmptyState>
          {rows.length === 0 ? "No mentees are assigned to you yet. Ask an admin to assign mentees." : "No students match these filters. Try clearing one."}
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="p-3">#</th><th className="p-3">Student</th><th className="p-3">Score</th><th className="p-3">Risk</th>
                <th className="p-3">Why</th><th className="p-3">Suggested action</th><th className="p-3">Contacted</th>
              </tr>
            </thead>
            <tbody>
              {shown.slice(0, SHOW_MAX).map((s, i) => (
                <tr key={s.student_id} className={`border-t align-top ${contacted.has(s.student_id) ? "opacity-50" : ""}`}>
                  <td className="p-3 text-slate-400">{i + 1}</td>
                  <td className="p-3">
                    <Link className="font-medium text-blue-700 hover:underline" href={`/faculty/student/${s.student_id}`}>{s.name}</Link>
                    <div className="text-xs text-slate-500">{s.student_id} · {s.department} · Y{s.year}{s.mentor_faculty_id ? ` · ${s.mentor_faculty_id}` : ""}</div>
                  </td>
                  <td className="p-3">
                    <div className="font-semibold">{s.success_score.toFixed(1)}</div>
                    <BandBadge band={s.band} />
                  </td>
                  <td className="space-y-1 p-3">
                    <RiskBadge level={s.academic_risk} prefix="Acad" />
                    <br />
                    <RiskBadge level={s.placement_risk} prefix="Place" />
                    {s.engagement_drop && <div className="text-xs text-amber-700">⚠ LMS drop</div>}
                  </td>
                  <td className="p-3 text-xs">
                    {topReasons(s, 2).map((d) => (
                      <div key={d.label}>• {d.label} ({d.value})</div>
                    ))}
                  </td>
                  <td className="p-3 text-xs">{s.actions?.[0] ?? "Routine monthly check-in"}</td>
                  <td className="p-3">
                    <input type="checkbox" aria-label={`Mark ${s.name} contacted`} checked={contacted.has(s.student_id)}
                      onChange={(e) => toggle(s.student_id, e.target.checked)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {shown.length > SHOW_MAX && (
            <p className="p-3 text-xs text-slate-500">Showing the top {SHOW_MAX} by priority. Narrow the filters or export the CSV for all {shown.length}.</p>
          )}
        </div>
      )}
    </div>
  );
}
