"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { contactState, coverage, followUps, needsContact, SLA_DAYS, type CaseRow, type StudentRow } from "@/components/shared/cases";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";
import { topReasons, type QueueRow } from "./queue";

const fmtDate = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

function Last({ studentId, cases }: { studentId: string; cases: CaseRow[] }) {
  const s = contactState(studentId, cases);
  if (s.kind === "never") return <span className="text-risk-red">not contacted yet</span>;
  return <span className="text-risk-amber">last contact {s.daysAgo} days ago</span>;
}

/**
 * The closed loop for one mentor: who needs a conversation today (a capped list, so it stays workable), what is due,
 * and how many flagged students have actually been contacted. Contact comes from the interventions they log.
 */
export function MyWeek({ rows, cases, onChanged }: { rows: QueueRow[]; cases: CaseRow[]; onChanged: () => void }) {
  const [busy, setBusy] = useState<number | null>(null);
  const now = useMemo(() => new Date(), []);
  const asStudents = rows as StudentRow[];
  const cov = useMemo(() => coverage(asStudents, cases, now), [asStudents, cases, now]);
  const today = useMemo(() => needsContact(asStudents, cases, now, 5) as QueueRow[], [asStudents, cases, now]);
  const due = useMemo(() => followUps(cases.filter((c) => !c.is_seeded), now), [cases, now]);
  const byId = useMemo(() => new Map(rows.map((r) => [r.student_id, r])), [rows]);
  const waiting = cov.red - cov.contacted;

  async function markDone(id: number) {
    setBusy(id);
    const { error } = await createClient().from("interventions").update({ status: "done" }).eq("id", id);
    setBusy(null);
    if (error) return toast.error("Could not update that follow-up. Please try again.");
    toast.success("Marked as done");
    onChanged();
  }

  const followRow = (c: CaseRow, tone: string) => {
    const s = byId.get(c.student_id);
    return (
      <li key={c.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
        <span className={`w-14 shrink-0 text-xs font-medium ${tone}`}>{c.followup_date ? fmtDate(c.followup_date) : "No date"}</span>
        <span className="min-w-0 flex-1">
          <Link href={`/faculty/student/${c.student_id}`} className="font-medium text-primary hover:underline">{s?.name ?? c.student_id}</Link>
          <span className="text-muted-foreground"> · {c.type}</span>
        </span>
        <Button size="sm" variant="outline" disabled={busy === c.id} onClick={() => markDone(c.id)}>{busy === c.id ? "Saving…" : "Done"}</Button>
      </li>
    );
  };

  const hasFollowUps = due.overdue.length + due.today.length + due.upcoming.length + due.undated.length > 0;

  return (
    <section className="space-y-3" aria-label="My week">
      <div className="flex flex-wrap items-end gap-x-6 gap-y-1">
        <h2 className="font-serif text-xl font-semibold">My week</h2>
        <p className="text-sm text-muted-foreground">
          {cov.red === 0
            ? "None of your mentees is flagged Red right now."
            : <>
                <b className="text-foreground">{cov.contacted} of {cov.red}</b> Red mentees contacted in the last {SLA_DAYS} days
                {waiting > 0 && <> · <b className="text-risk-red">{waiting} waiting</b></>}
              </>}
        </p>
      </div>
      {cov.red > 0 && (
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={cov.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Red mentees contacted this week">
          <div className="h-full bg-risk-green transition-all" style={{ width: `${cov.pct}%` }} />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <h3 className="text-sm font-semibold">Start with these {today.length > 0 ? today.length : ""}</h3>
          <p className="mb-2 text-xs text-muted-foreground">The most urgent flagged students nobody has contacted this week. A short list on purpose.</p>
          {today.length === 0 ? (
            <p className="rounded-md bg-risk-green-bg p-3 text-sm text-risk-green">
              {cov.red === 0 ? "Nobody needs a contact right now." : "Every Red mentee has been contacted this week. Nice work."}
            </p>
          ) : (
            <ol className="divide-y">
              {today.map((s, i) => (
                <li key={s.student_id} className="flex flex-wrap items-start gap-3 py-2 text-sm">
                  <span className="mt-0.5 w-5 shrink-0 text-muted-foreground">{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <Link href={`/faculty/student/${s.student_id}`} className="font-medium text-primary hover:underline">{s.name}</Link>
                    <span className="text-xs text-muted-foreground"> · {s.department} · Y{s.year} · <Last studentId={s.student_id} cases={cases} /></span>
                    <span className="block text-xs text-muted-foreground">{topReasons(s, 1)[0]?.label ?? s.actions?.[0] ?? "Flagged for a check-in"}</span>
                  </span>
                  <Button asChild size="sm"><Link href={`/faculty/student/${s.student_id}`}>Open</Link></Button>
                </li>
              ))}
            </ol>
          )}
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold">Follow-ups</h3>
          <p className="mb-2 text-xs text-muted-foreground">Open interventions with a date. Log one from a student&apos;s page and set a follow-up date.</p>
          {!hasFollowUps ? (
            <p className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">No follow-ups scheduled yet.</p>
          ) : (
            <ul className="divide-y">
              {due.overdue.map((c) => followRow(c, "text-risk-red"))}
              {due.today.map((c) => followRow(c, "text-risk-amber"))}
              {due.upcoming.map((c) => followRow(c, "text-muted-foreground"))}
              {due.undated.map((c) => followRow(c, "text-muted-foreground"))}
            </ul>
          )}
          {due.overdue.length > 0 && <p className="mt-2 text-xs font-medium text-risk-red">{due.overdue.length} overdue</p>}
        </Card>
      </div>
    </section>
  );
}
