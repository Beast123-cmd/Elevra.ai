"use client";
import { AdminOverview } from "@/components/admin/AdminOverview";
import type { OverviewRow } from "@/components/admin/aggregate";
import { fetchAllRows } from "@/components/admin/paginate";
import { EmptyState } from "@/components/shared/Kpi";
import { useCachedQuery } from "@/components/shared/useCachedQuery";
import { Skeleton } from "@/components/ui/skeleton";
import { createClient } from "@/lib/supabase/client";
import type { Insight } from "@/lib/types";
import type { CaseRow } from "@/components/shared/cases";

const COLUMNS =
  "student_id,name,department,year,batch,success_score,band,academic_risk,placement_risk,segment,engagement_drop," +
  "academic,attendance,lms,placement,skills,engagement,feedback";

async function loadOverview(): Promise<{ rows: OverviewRow[]; insights: Insight[]; cases: CaseRow[] | null }> {
  const supabase = createClient();
  // the two requests do not depend on each other, so run them together
  // contact data is optional: the overview still renders if it cannot be read
  const casesQuery = fetchAllRows<CaseRow>((from, to) =>
    supabase.from("interventions").select("id,student_id,type,status,followup_date,created_at,is_seeded").order("id").range(from, to) as never,
  ).catch(() => null);
  const [rows, insights, cases] = await Promise.all([
    fetchAllRows<OverviewRow>((from, to) =>
      supabase.from("student_unified_view").select(COLUMNS).not("success_score", "is", null).order("student_id").range(from, to) as never,
    ),
    supabase.from("analytics").select("payload").eq("key", "insights").maybeSingle(),
    casesQuery,
  ]);
  return { rows, insights: (insights.data?.payload as Insight[] | undefined) ?? [], cases };
}

export default function AdminPage() {
  const { data, error, loading } = useCachedQuery("admin:overview", loadOverview);

  if (error) return <EmptyState>Could not load the overview: {error}</EmptyState>;
  if (loading || !data) return <Skeleton className="h-96 w-full" />;
  if (data.rows.length === 0) return <EmptyState>No scored students yet. Run the data pipeline seed first.</EmptyState>;
  return <AdminOverview rows={data.rows} insights={data.insights} cases={data.cases} />;
}
