"use client";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/shared/Kpi";
import { buildAudience, describeAudience } from "@/components/shared/audience";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/client";

interface Row { id: number; audience: string; title: string; body: string; created_at: string }

const DEPARTMENTS = ["Comp", "IT", "ENTC", "AI&DS"];
const FIELD = "h-9 w-full rounded-md border border-slate-300 bg-white px-3 text-sm";
const TITLE_MAX = 120;
const BODY_MAX = 1000;

export default function NotificationsPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [kind, setKind] = useState("all");
  const [target, setTarget] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error: err } = await supabase.from("notifications").select("id,audience,title,body,created_at").order("created_at", { ascending: false }).limit(30);
    if (err) return setError(err.message);
    setRows((data ?? []) as Row[]);
  }, [supabase]);

  useEffect(() => {
    load();
  }, [load]);

  const audience = buildAudience(kind, kind === "dept" && !target ? DEPARTMENTS[0] : target);
  const valid = audience.ok && title.trim().length > 0 && body.trim().length > 0 && title.length <= TITLE_MAX && body.length <= BODY_MAX;

  async function send() {
    if (!audience.ok || !valid) return;
    setSaving(true);
    const { data: auth } = await supabase.auth.getSession();
    const row = { audience: audience.value, title: title.trim(), body: body.trim() };
    let { error: err } = await supabase.from("notifications").insert({ ...row, created_by: auth.session?.user.id ?? null });
    if (err?.code === "23503") ({ error: err } = await supabase.from("notifications").insert(row)); // creator has no users row yet
    setSaving(false);
    if (err) return toast.error("Could not post the notification. Please try again.");
    toast.success(`Posted to: ${describeAudience(audience.value)}`);
    setTitle("");
    setBody("");
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Placement notifications</h1>
        <p className="text-sm text-slate-500">Post drives, deadlines and workshops. Students see them in their notifications feed.</p>
      </div>

      <Card className="space-y-3 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            Audience
            <select className={`${FIELD} mt-1`} value={kind} onChange={(e) => { setKind(e.target.value); setTarget(""); }}>
              <option value="all">Everyone</option>
              <option value="dept">A department</option>
              <option value="year">A year</option>
              <option value="student">One student</option>
            </select>
          </label>
          {kind === "dept" && (
            <label className="text-sm">
              Department
              <select className={`${FIELD} mt-1`} value={target || DEPARTMENTS[0]} onChange={(e) => setTarget(e.target.value)}>
                {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </label>
          )}
          {kind === "year" && (
            <label className="text-sm">
              Year
              <select className={`${FIELD} mt-1`} value={target} onChange={(e) => setTarget(e.target.value)}>
                <option value="">Select…</option>
                {[2, 3, 4].map((y) => <option key={y} value={y}>Year {y}</option>)}
              </select>
            </label>
          )}
          {kind === "student" && (
            <label className="text-sm">
              Student id
              <input className={`${FIELD} mt-1`} placeholder="5 digits, e.g. 42178" value={target} onChange={(e) => setTarget(e.target.value)} />
            </label>
          )}
        </div>
        <label className="block text-sm">
          Title
          <input className={`${FIELD} mt-1`} maxLength={TITLE_MAX} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block text-sm">
          Message
          <textarea className="mt-1 w-full rounded-md border border-slate-300 p-2 text-sm" rows={4} maxLength={BODY_MAX} value={body} onChange={(e) => setBody(e.target.value)} />
          <span className="text-xs text-slate-500">{body.length}/{BODY_MAX}</span>
        </label>
        {!audience.ok && kind !== "all" && target !== "" && <p className="text-xs text-red-700">{audience.error}</p>}
        <Button disabled={!valid || saving} onClick={send}>{saving ? "Posting…" : "Post notification"}</Button>
      </Card>

      <Card className="p-4">
        <h2 className="mb-2 text-sm font-semibold">Recent notifications</h2>
        {error ? (
          <EmptyState>Could not load notifications: {error}</EmptyState>
        ) : rows === null ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : rows.length === 0 ? (
          <EmptyState>No notifications posted yet.</EmptyState>
        ) : (
          <ul className="divide-y text-sm">
            {rows.map((r) => (
              <li key={r.id} className="py-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <b>{r.title}</b>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs">{describeAudience(r.audience)}</span>
                  <span className="ml-auto text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
                </div>
                <p className="text-slate-600">{r.body}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
