"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { BriefCard } from "@/components/faculty/BriefCard";
import { canViewStudent } from "@/components/faculty/interventions";
import { InterventionPanel } from "@/components/faculty/InterventionPanel";
import { MessageDrafts } from "@/components/faculty/MessageDrafts";
import { EmptyState } from "@/components/shared/Kpi";
import { getIdentity } from "@/components/shared/session";
import { StudentProfile } from "@/components/shared/StudentProfile";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Cohort, Profile } from "@/lib/types";

type Loaded =
  | { kind: "missing" }
  | { kind: "forbidden" }
  | { kind: "ready"; profile: Profile; means: Cohort["pillar_means"] | undefined; facultyId: string | null };

async function loadStudent(id: string): Promise<Loaded> {
  const supabase = createClient();
  const [me, scored, cohort] = await Promise.all([
    getIdentity(),
    supabase.from("scores").select("profile").eq("student_id", id).maybeSingle(),
    supabase.from("analytics").select("payload").eq("key", "cohort").maybeSingle(),
  ]);
  if (scored.error) throw new Error(scored.error.message);
  const profile = scored.data?.profile as Profile | undefined;
  if (!profile) return { kind: "missing" };
  if (!canViewStudent({ role: me?.role ?? "", facultyId: me?.facultyId ?? null }, profile.mentor_faculty_id)) return { kind: "forbidden" };
  return { kind: "ready", profile, means: (cohort.data?.payload as Cohort | undefined)?.pillar_means, facultyId: me?.facultyId ?? null };
}

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: state, error, loading } = useCachedQuery(`student360:${id}`, () => loadStudent(id));

  const back = (
    <Link href="/faculty" className="text-sm text-primary hover:underline">
      ← Back to the action queue
    </Link>
  );

  if (error) return <EmptyState>Could not load this student: {error}</EmptyState>;
  if (loading || !state) return <Skeleton className="h-96 w-full" />;
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
        actions={
          <div className="space-y-4">
            <BriefCard profile={profile} />
            <MessageDrafts profile={profile} />
            <InterventionPanel studentId={profile.student_id} scoreBefore={profile.score} facultyId={facultyId} />
          </div>
        }
      />
    </div>
  );
}
