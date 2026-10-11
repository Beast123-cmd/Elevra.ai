"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { invalidateCache } from "@/components/shared/queryCache";
import { createClient } from "@/lib/supabase/client";
import { INTERVENTION_TYPES, NOTE_MAX, STATUSES, validateIntervention, type Status } from "./interventions";

interface Row { id: number; type: string; note: string | null; status: Status; followup_date: string | null; score_before: number | null; created_at: string; is_seeded: boolean }

const FIELD = "h-9 w-full rounded-md border border-input bg-card px-3 text-sm";
const STATUS_LABEL: Record<Status, string> = { planned: "Planned", in_progress: "In progress", done: "Done" };

export function InterventionPanel({ studentId, scoreBefore, facultyId }: { studentId: string; scoreBefore: number; facultyId: string | null }) {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ type: "", note: "", followup_date: "", status: "done" });
  const [errors, setErrors] = useState<Partial<Record<"type" | "note" | "followup_date", string>>>({});
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from("interventions")
      .select("id,type,note,status,followup_date,score_before,created_at,is_seeded")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false });
    if (err) return setError(err.message);
    setRows((data ?? []) as Row[]);
  }, [supabase, studentId]);

  useEffect(() => {
    load();
  }, [load]);

  async function save() {
    const found = validateIntervention({ type: form.type, note: form.note, followup_date: form.followup_date });
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    setSaving(true);
    const { error: err } = await supabase.from("interventions").insert({
      student_id: studentId, faculty_id: facultyId, type: form.type, note: form.note.trim() || null,
      followup_date: form.followup_date || null, status: form.status, score_before: scoreBefore,
    });
    setSaving(false);
    if (err) return toast.error("Could not save the intervention. Please try again.");
    toast.success("Intervention logged");
    setOpen(false);
    setForm({ type: "", note: "", followup_date: "", status: "done" });
    invalidateCache("faculty:"); // the queue, My week and coverage are now out of date
    invalidateCache("admin:");
    load();
  }

  async function setStatus(id: number, status: Status) {
    const previous = rows;
    setRows((rs) => (rs ?? []).map((r) => (r.id === id ? { ...r, status } : r)));
    const { error: err } = await supabase.from("interventions").update({ status }).eq("id", id);
    if (err) {
      setRows(previous);
      toast.error("Could not update the status.");
      return;
    }
    invalidateCache("faculty:");
    invalidateCache("admin:");
  }

  return (
    <Card data-motion-card className="rounded-xl border-border shadow-sm shadow-slate-900/[0.02] space-y-3 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto">
          <h2 className="text-sm font-semibold">Interventions</h2>
          <p className="text-xs text-muted-foreground">Log what you did, then track follow-up. Effectiveness is measured from the score change.</p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>Log intervention</Button>
      </div>

      {error ? (
        <p className="text-sm text-risk-red">Could not load interventions: {error}</p>
      ) : rows === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No interventions logged for this student yet.</p>
      ) : (
        <ul className="divide-y text-sm">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="font-medium">{r.type}{r.is_seeded && <span className="ml-2 text-xs font-normal text-muted-foreground">(historical)</span>}</div>
                {r.note && <div className="text-muted-foreground">{r.note}</div>}
                <div className="text-xs text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString()}
                  {r.followup_date && ` · follow-up ${r.followup_date}`}
                  {r.score_before !== null && ` · score then ${Number(r.score_before).toFixed(1)}`}
                </div>
              </div>
              <select className="h-8 rounded-md border border-input px-2 text-xs" value={r.status} aria-label="Follow-up status"
                onChange={(e) => setStatus(r.id, e.target.value as Status)}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log intervention</DialogTitle>
            <DialogDescription>Record what was done for this student. Their current score is saved for comparison.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm">
              Type
              <select className={`${FIELD} mt-1`} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="">Select…</option>
                {INTERVENTION_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              {errors.type && <span className="text-xs text-risk-red">{errors.type}</span>}
            </label>
            <label className="block text-sm">
              Status
              <select className={`${FIELD} mt-1`} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                <option value="done">Done: it already happened</option>
                <option value="in_progress">In progress</option>
                <option value="planned">Planned: still to do</option>
              </select>
              <span className="text-xs text-muted-foreground">Done or in-progress counts as contact for the weekly target.</span>
            </label>
            <label className="block text-sm">
              Note (optional)
              <textarea className="mt-1 w-full rounded-md border border-input p-2 text-sm" rows={3} value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })} />
              <span className="text-xs text-muted-foreground">{form.note.length}/{NOTE_MAX}</span>
              {errors.note && <span className="ml-2 text-xs text-risk-red">{errors.note}</span>}
            </label>
            <label className="block text-sm">
              Follow-up date (optional)
              <input type="date" className={`${FIELD} mt-1`} value={form.followup_date} onChange={(e) => setForm({ ...form, followup_date: e.target.value })} />
              {errors.followup_date && <span className="text-xs text-risk-red">{errors.followup_date}</span>}
            </label>
            <Button disabled={saving} onClick={save}>{saving ? "Saving…" : "Save intervention"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
