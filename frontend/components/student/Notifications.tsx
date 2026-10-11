"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StudentLoading } from "./StudentPage";
import { StudentReveal } from "./StudentReveal";
import { ProfileGate } from "./ProfileGate";
import { useSearchParams } from "next/navigation";
import { StudentNextStep } from "./StudentNextStep";

interface Note { id: number; audience: string; title: string; body: string; created_at: string }
type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; notes: Note[] };

const MOCK_NOTES: Note[] = [
  { id: 1, audience: "all", title: "Campus drive: sample company", body: "Registrations open until Friday. Backlog-free students only.", created_at: "2026-10-10T09:00:00Z" },
  { id: 2, audience: "dept:Comp", title: "Coding contest this weekend", body: "Open to all Computer Engineering students.", created_at: "2026-10-09T09:00:00Z" },
];

const pendingLoads = new Map<string, Promise<Note[]>>();

/** Does this notification's audience include the student? Audiences: all | dept:<d> | year:<y> | student:<id>. */
export function isForStudent(audience: string, p: Pick<Profile, "department" | "year" | "student_id">): boolean {
  return audience === "all" || audience === `dept:${p.department}` || audience === `year:${p.year}` || audience === `student:${p.student_id}`;
}

function load(p: Profile): Promise<Note[]> {
  const pending = pendingLoads.get(p.student_id);
  if (pending) return pending;

  const request = (async () => {
    const { data, error } = await createClient()
      .from("notifications")
      .select("id,audience,title,body,created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return ((data ?? []) as Note[]).filter((note) => isForStudent(note.audience, p));
  })();

  pendingLoads.set(p.student_id, request);
  void request.then(
    () => { if (pendingLoads.get(p.student_id) === request) pendingLoads.delete(p.student_id); },
    () => { if (pendingLoads.get(p.student_id) === request) pendingLoads.delete(p.student_id); },
  );
  return request;
}

function Feed({ p }: { p: Profile }) {
  const mock = useSearchParams().get("mock") === "1";
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (mock) {
      setState({ status: "ready", notes: MOCK_NOTES });
      return;
    }
    let cancelled = false;
    load(p)
      .then((notes) => !cancelled && setState({ status: "ready", notes }))
      .catch((e: Error) => !cancelled && setState({ status: "error", message: e.message }));
    return () => { cancelled = true; };
  }, [p, mock, attempt]);

  if (state.status === "loading") {
    return <StudentLoading rows={2} />;
  }
  if (state.status === "error") {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Couldn&apos;t load notifications</CardTitle>
          <CardDescription>{state.message}. Try again in a moment.</CardDescription>
          <Button variant="outline" className="mt-2 w-fit" onClick={() => { setState({ status: "loading" }); setAttempt((value) => value + 1); }}>Retry</Button>
        </CardHeader>
      </Card>
    );
  }
  if (state.notes.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-muted-foreground">
          <Bell className="h-5 w-5" />
          <p className="text-sm">No notifications yet. Placement drives and announcements for you will show up here.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <section className="space-y-4" aria-labelledby="inbox-updates-heading">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="inbox-updates-heading" className="text-base font-semibold text-foreground">Latest campus updates</h2>
          <p className="mt-1 text-sm text-muted-foreground">{state.notes.length} update{state.notes.length === 1 ? "" : "s"} for your department, year or account.</p>
        </div>
        {state.notes.length > 5 && (
          <Button variant="ghost" size="sm" className="min-h-10 text-primary" onClick={() => setShowAll((value) => !value)} aria-expanded={showAll}>
            {showAll ? "Show recent only" : `Show all ${state.notes.length}`}
          </Button>
        )}
      </div>
      <ul className="space-y-3">
        {(showAll ? state.notes : state.notes.slice(0, 5)).map((n) => (
          <li key={n.id}>
            <StudentReveal>
              <Card className="overflow-hidden rounded-xl border-border bg-card shadow-sm shadow-slate-900/[0.02]">
                <CardHeader className="px-4 pb-2 pt-4 sm:px-5">
                  <CardTitle className="text-base leading-6 text-foreground">{n.title}</CardTitle>
                  <CardDescription>
                    {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </CardDescription>
                </CardHeader>
                <CardContent className="px-4 pb-4 text-sm leading-6 text-muted-foreground sm:px-5">{n.body}</CardContent>
              </Card>
            </StudentReveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Notifications() {
  return (
    <ProfileGate>
      {(p) => (
        <div className="space-y-5 sm:space-y-6">
          <Feed p={p} />
          <StudentNextStep
            label="KEEP GOING"
            title="Return to your plan"
            description="Pick up with one practical action based on your current records."
            href="/student/improve"
          />
        </div>
      )}
    </ProfileGate>
  );
}
