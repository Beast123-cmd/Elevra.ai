"use client";
import { useEffect, useState } from "react";
import { fetchAllRows } from "@/components/admin/paginate";
import { ActionQueue } from "@/components/faculty/ActionQueue";
import type { QueueRow } from "@/components/faculty/queue";
import { EmptyState } from "@/components/shared/Kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";

const COLUMNS =
  "student_id,success_score,band,academic_risk,placement_risk,segment,priority,engagement_drop,drivers,actions:profile->actions," +
  "students!inner(name,department,year,mentor_faculty_id)";

type Raw = Omit<QueueRow, "name" | "department" | "year" | "mentor_faculty_id"> & {
  students: { name: string; department: string; year: number; mentor_faculty_id: string | null };
};

export default function FacultyPage() {
  const [rows, setRows] = useState<QueueRow[] | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        if (sessionError) throw new Error(sessionError.message);
        const user = data.session?.user;
        const admin = user?.app_metadata?.role === "admin";
        const facultyId = user?.app_metadata?.faculty_id as string | undefined;
        setIsAdmin(admin);
        if (!admin && !facultyId) throw new Error("This login is not linked to a faculty record.");
        const raw = await fetchAllRows<Raw>((from, to) => {
          let q = supabase.from("scores").select(COLUMNS).order("priority", { ascending: false }).order("student_id").range(from, to);
          if (!admin) q = q.eq("students.mentor_faculty_id", facultyId!);
          return q as never;
        });
        setRows(raw.map(({ students, ...r }) => ({ ...r, ...students })));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
  }, []);

  if (error) return <EmptyState>Could not load the queue: {error}</EmptyState>;
  if (rows === null) return <Skeleton className="h-96 w-full" />;
  return <ActionQueue rows={rows} showMentorFilter={isAdmin} />;
}
