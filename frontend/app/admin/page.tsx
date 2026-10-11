"use client";
import { useEffect, useState } from "react";
import { AdminOverview } from "@/components/admin/AdminOverview";
import type { OverviewRow } from "@/components/admin/aggregate";
import { fetchAllRows } from "@/components/admin/paginate";
import { EmptyState } from "@/components/shared/Kpi";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Insight } from "@/lib/types";

const COLUMNS =
  "student_id,name,department,year,batch,success_score,band,academic_risk,placement_risk,segment,engagement_drop," +
  "academic,attendance,lms,placement,skills,engagement,feedback";

export default function AdminPage() {
  const [rows, setRows] = useState<OverviewRow[] | null>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      try {
        const all = await fetchAllRows<OverviewRow>((from, to) =>
          supabase.from("student_unified_view").select(COLUMNS).not("success_score", "is", null).order("student_id").range(from, to) as never,
        );
        setRows(all);
        const { data } = await supabase.from("analytics").select("payload").eq("key", "insights").maybeSingle();
        setInsights((data?.payload as Insight[] | undefined) ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      }
    })();
  }, []);

  if (error) return <EmptyState>Could not load the overview: {error}</EmptyState>;
  if (rows === null) return <Skeleton className="h-96 w-full" />;
  if (rows.length === 0) return <EmptyState>No scored students yet. Run the data pipeline seed first.</EmptyState>;
  return <AdminOverview rows={rows} insights={insights} />;
}
