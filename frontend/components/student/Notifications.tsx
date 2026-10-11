"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ProfileGate } from "./ProfileGate";
import { useSearchParams } from "next/navigation";

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
  }, [p, mock]);

  if (state.status === "loading") {
    return <div className="space-y-3" aria-busy="true"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>;
  }
  if (state.status === "error") {
    return (
      <Card role="alert">
        <CardHeader>
          <CardTitle>Couldn&apos;t load notifications</CardTitle>
          <CardDescription>{state.message}. Try again in a moment.</CardDescription>
        </CardHeader>
      </Card>
    );
  }
  if (state.notes.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-slate-500">
          <Bell className="h-5 w-5" />
          <p className="text-sm">No notifications yet. Placement drives and announcements for you will show up here.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <ul className="space-y-3">
      {state.notes.map((n) => (
        <li key={n.id}>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{n.title}</CardTitle>
              <CardDescription>
                {new Date(n.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm">{n.body}</CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}

export function Notifications() {
  return <ProfileGate>{(p) => <Feed p={p} />}</ProfileGate>;
}
