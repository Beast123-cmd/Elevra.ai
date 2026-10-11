"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { api } from "@/lib/api";
import type { PracticeTask } from "./types";

/** The 7-day practice checklist. Ticking saves through the backend, which checks the task belongs to the student. */
export function PracticePlan({ tasks, readOnly = false }: { tasks: PracticeTask[]; readOnly?: boolean }) {
  const [items, setItems] = useState(tasks);
  const [error, setError] = useState<string | null>(null);
  const done = items.filter((t) => t.done).length;

  async function toggle(task: PracticeTask) {
    if (readOnly) return;
    const next = !task.done;
    setError(null);
    setItems((all) => all.map((t) => (t.id === task.id ? { ...t, done: next } : t)));
    try {
      await api(`/interview/tasks/${task.id}`, { done: next });
    } catch {
      setItems((all) => all.map((t) => (t.id === task.id ? { ...t, done: !next } : t)));
      setError("Couldn't save that. Check your connection and try again.");
    }
  }

  if (items.length === 0) return <p className="text-sm text-muted-foreground">No practice plan for this interview.</p>;
  const days = Array.from(new Set(items.map((t) => t.day))).sort((a, b) => a - b);
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden="true">
          <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${(done / items.length) * 100}%` }} />
        </div>
        <span className="text-xs tabular-nums text-muted-foreground">{done} of {items.length} done</span>
      </div>
      {error && <p role="alert" className="text-xs text-risk-red">{error}</p>}
      <ol className="space-y-2">
        {days.map((day) => (
          <li key={day} className="rounded-lg border border-border bg-card p-3">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Day {day}</p>
            <ul className="space-y-1.5">
              {items.filter((t) => t.day === day).map((t) => (
                <li key={t.id}>
                  <button type="button" onClick={() => void toggle(t)} disabled={readOnly} aria-pressed={t.done}
                    className="flex w-full items-start gap-2.5 rounded-md p-1 text-left text-sm hover:bg-muted disabled:cursor-default disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${t.done ? "border-primary bg-primary text-primary-foreground" : "border-input bg-card"}`} aria-hidden="true">
                      {t.done && <Check className="h-3 w-3" />}
                    </span>
                    <span className={t.done ? "text-muted-foreground line-through" : "text-foreground"}>{t.task}</span>
                  </button>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}
