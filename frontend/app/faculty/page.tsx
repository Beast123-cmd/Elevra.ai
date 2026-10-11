"use client";
import { fetchAllRows } from "@/components/admin/paginate";
import { ActionQueue } from "@/components/faculty/ActionQueue";
import type { QueueRow } from "@/components/faculty/queue";
import { EmptyState } from "@/components/shared/Kpi";
import { getIdentity } from "@/components/shared/session";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

const COLUMNS =
  "student_id,success_score,band,academic_risk,placement_risk,segment,priority,engagement_drop,drivers,actions:profile->actions," +
  "students!inner(name,department,year,mentor_faculty_id)";

type Raw = Omit<QueueRow, "name" | "department" | "year" | "mentor_faculty_id"> & {
  students: { name: string; department: string; year: number; mentor_faculty_id: string | null };
};

async function loadQueue(): Promise<{ rows: QueueRow[]; isAdmin: boolean }> {
  const supabase = createClient();
  const me = await getIdentity();
  const isAdmin = me?.role === "admin";
  if (!isAdmin && !me?.facultyId) throw new Error("This login is not linked to a faculty record.");
  const raw = await fetchAllRows<Raw>((from, to) => {
    let q = supabase.from("scores").select(COLUMNS).order("priority", { ascending: false }).order("student_id").range(from, to);
    if (!isAdmin) q = q.eq("students.mentor_faculty_id", me!.facultyId!);
    return q as never;
  });
  return { rows: raw.map(({ students, ...r }) => ({ ...r, ...students })), isAdmin };
}

export default function FacultyPage() {
  const { data, error, loading } = useCachedQuery("faculty:queue", loadQueue);

  if (error) return <EmptyState>Could not load the queue: {error}</EmptyState>;
  if (loading || !data) return <Skeleton className="h-96 w-full" />;
  return <ActionQueue rows={data.rows} showMentorFilter={data.isAdmin} />;
}
