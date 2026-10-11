"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { canViewStudent } from "@/components/faculty/interventions";
import { InterventionPanel } from "@/components/faculty/InterventionPanel";
import { EmptyState } from "@/components/shared/Kpi";
import { StudentProfile } from "@/components/shared/StudentProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Cohort, Profile } from "@/lib/types";

type State =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "missing" }
  | { kind: "forbidden" }
  | { kind: "ready"; profile: Profile; means: Cohort["pillar_means"] | undefined; facultyId: string | null };

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data: auth } = await supabase.auth.getUser();
        const role = (auth.user?.app_metadata?.role as string | undefined) ?? "";
        const facultyId = (auth.user?.app_metadata?.faculty_id as string | undefined) ?? null;
        const [scored, cohort] = await Promise.all([
          supabase.from("scores").select("profile").eq("student_id", id).maybeSingle(),
          supabase.from("analytics").select("payload").eq("key", "cohort").maybeSingle(),
        ]);
        if (scored.error) throw new Error(scored.error.message);
        const profile = scored.data?.profile as Profile | undefined;
        if (!profile) return setState({ kind: "missing" });
        if (!canViewStudent({ role, facultyId }, profile.mentor_faculty_id)) return setState({ kind: "forbidden" });
        const means = (cohort.data?.payload as Cohort | undefined)?.pillar_means;
        setState({ kind: "ready", profile, means, facultyId });
      } catch (e) {
        setState({ kind: "error", message: e instanceof Error ? e.message : "Unknown error" });
      }
    })();
  }, [id]);

  const back = (
    <Link href="/faculty" className="text-sm text-blue-700 hover:underline">
      ← Back to the action queue
    </Link>
  );

  if (state.kind === "loading") return <Skeleton className="h-96 w-full" />;
  if (state.kind === "error") return <EmptyState>Could not load this student: {state.message}</EmptyState>;
  if (state.kind === "missing") return <div className="space-y-3">{back}<EmptyState>No student found with id “{id}”.</EmptyState></div>;
  if (state.kind === "forbidden") return <div className="space-y-3">{back}<EmptyState>This student is not one of your mentees.</EmptyState></div>;

  const { profile, means, facultyId } = state;
  return (
    <div className="space-y-3">
      {back}
      <StudentProfile
        profile={profile}
        cohortMeans={means}
        mode="faculty"
        actions={<InterventionPanel studentId={profile.student_id} scoreBefore={profile.score} facultyId={facultyId} />}
      />
    </div>
  );
}
