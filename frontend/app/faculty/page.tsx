"use client";
import { fetchAllRows } from "@/components/admin/paginate";
import { ActionQueue } from "@/components/faculty/ActionQueue";
import { MyWeek } from "@/components/faculty/MyWeek";
import type { QueueRow } from "@/components/faculty/queue";
import type { CaseRow } from "@/components/shared/cases";
import { EmptyState } from "@/components/shared/Kpi";
import { getIdentity } from "@/components/shared/session";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

const COLUMNS =
  "student_id,success_score,band,academic_risk,placement_risk,segment,priority,engagement_drop,drivers,actions:profile->actions," +
  "students!inner(name,department,year,mentor_faculty_id)";
const CASE_COLUMNS = "id,student_id,type,status,followup_date,created_at,is_seeded,note";

type Raw = Omit<QueueRow, "name" | "department" | "year" | "mentor_faculty_id"> & {
  students: { name: string; department: string; year: number; mentor_faculty_id: string | null };
};

async function loadQueue(): Promise<{ rows: QueueRow[]; cases: CaseRow[]; isAdmin: boolean }> {
  const supabase = createClient();
  const me = await getIdentity();
  const isAdmin = me?.role === "admin";
  if (!isAdmin && !me?.facultyId) throw new Error("This login is not linked to a faculty record.");
  // row-level security limits both reads to this mentor's own students
  const [raw, cases] = await Promise.all([
    fetchAllRows<Raw>((from, to) => {
      let q = supabase.from("scores").select(COLUMNS).order("priority", { ascending: false }).order("student_id").range(from, to);
      if (!isAdmin) q = q.eq("students.mentor_faculty_id", me!.facultyId!);
      return q as never;
    }),
    fetchAllRows<CaseRow>((from, to) => supabase.from("interventions").select(CASE_COLUMNS).order("id").range(from, to) as never),
  ]);
  return { rows: raw.map(({ students, ...r }) => ({ ...r, ...students })), cases, isAdmin };
}

export default function FacultyPage() {
  const { data, error, loading, reload } = useCachedQuery("faculty:queue", loadQueue);

  if (error) return <EmptyState>Could not load the queue: {error}</EmptyState>;
  if (loading || !data) return <Skeleton className="h-96 w-full" />;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Action Queue</h1>
        <p className="text-sm text-slate-500">{data.isAdmin ? "Every mentee across the institution." : "Your mentees: who needs a conversation, why, and what to do."}</p>
      </div>
      {!data.isAdmin && <MyWeek rows={data.rows} cases={data.cases} onChanged={reload} />}
      <ActionQueue rows={data.rows} cases={data.cases} showMentorFilter={data.isAdmin} />
    </div>
  );
}
