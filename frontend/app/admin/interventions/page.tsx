"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis, ReferenceLine } from "recharts";
import { effectiveness } from "@/components/admin/effectiveness";
import { fetchAllRows } from "@/components/admin/paginate";
import { EmptyState, Kpi } from "@/components/shared/Kpi";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

interface Row {
  id: number; student_id: string; type: string; status: string; note: string | null;
  score_before: number | null; score_after: number | null; created_at: string; is_seeded: boolean;
}

export default function InterventionsPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    fetchAllRows<Row>(
      (from, to) =>
        supabase.from("interventions").select("id,student_id,type,status,note,score_before,score_after,created_at,is_seeded")
          .order("id").range(from, to) as never,
    ).then(setRows, (e) => setError(e instanceof Error ? e.message : "Unknown error"));
  }, []);

  const eff = useMemo(() => effectiveness(rows ?? []), [rows]);
  const live = useMemo(() => (rows ?? []).filter((r) => !r.is_seeded).sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 15), [rows]);
  const open = (rows ?? []).filter((r) => r.status !== "done").length;
  const synthetic = (rows ?? []).filter((r) => r.is_seeded).length;

  if (error) return <EmptyState>Could not load interventions: {error}</EmptyState>;
  if (rows === null) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Intervention effectiveness</h1>
        <p className="text-sm text-slate-500">
          Average change in a student&apos;s success score after each type of support. This shows association, not proof of cause: students are not randomly assigned.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kpi label="Interventions logged" value={eff.total.toLocaleString()} />
        <Kpi label="With a measured outcome" value={(eff.total - eff.pending).toLocaleString()} />
        <Kpi label="Awaiting outcome" value={eff.pending.toLocaleString()} hint="score re-measured after the next refresh" />
        <Kpi label="Still open" value={open.toLocaleString()} hint="planned or in progress" />
      </div>

      <Card className="p-4">
        <h2 className="text-sm font-semibold">Average score change by intervention type</h2>
        {synthetic > 0 && <p className="text-xs text-amber-700">Includes {synthetic} synthetic historical examples for demonstration; their score changes are simulated.</p>}
        {eff.rows.length === 0 ? (
          <EmptyState>No measured outcomes yet. Log interventions from a student&apos;s page; their effect appears after the next score refresh.</EmptyState>
        ) : (
          <>
            <ResponsiveContainer width="100%" height={Math.max(200, eff.rows.length * 48)}>
              <BarChart data={eff.rows} layout="vertical" margin={{ left: 30, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" unit=" pts" />
                <YAxis type="category" dataKey="type" width={170} tick={{ fontSize: 12 }} />
                <ReferenceLine x={0} stroke="#475569" />
                <Tooltip formatter={(v) => `${Number(v) > 0 ? "+" : ""}${v} pts`} />
                <Bar dataKey="avgChange" name="Average change" isAnimationActive={false}>
                  {eff.rows.map((r) => (
                    <Cell key={r.type} fill={r.avgChange >= 0 ? "#059669" : "#dc2626"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <table className="mt-2 w-full text-sm">
              <thead className="text-left text-xs uppercase text-slate-500">
                <tr><th className="p-2">Type</th><th className="p-2 text-right">Students</th><th className="p-2 text-right">Avg change</th><th className="p-2 text-right">Improved</th></tr>
              </thead>
              <tbody>
                {eff.rows.map((r) => (
                  <tr key={r.type} className="border-t">
                    <td className="p-2">{r.type}</td>
                    <td className="p-2 text-right">{r.n}</td>
                    <td className="p-2 text-right">{r.avgChange > 0 ? "+" : ""}{r.avgChange}</td>
                    <td className="p-2 text-right">{r.improvedPct}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Recently logged</h2>
        {live.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing logged yet.</p>
        ) : (
          <ul className="divide-y text-sm">
            {live.map((r) => (
              <li key={r.id} className="flex flex-wrap gap-3 py-2">
                <Link href={`/faculty/student/${r.student_id}`} className="font-medium text-blue-700 hover:underline">{r.student_id}</Link>
                <span>{r.type}</span>
                <span className="text-slate-500">{r.note}</span>
                <span className="ml-auto text-xs text-slate-500">{r.status.replace("_", " ")} · {new Date(r.created_at).toLocaleDateString()}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
