import type { OverviewRow } from "./aggregate.ts";

/**
 * What the dean's brief can still say when the API is offline: only facts the Overview already has (risk counts by
 * department). It cannot say anything about contact or follow-ups, so it does not pretend to.
 */
export function localWeeklyBrief(rows: Pick<OverviewRow, "department" | "academic_risk" | "placement_risk">[]): string {
  const red = rows.filter((r) => r.academic_risk === "Red" || r.placement_risk === "Red");
  const acad = rows.filter((r) => r.academic_risk === "Red").length;
  const place = rows.filter((r) => r.placement_risk === "Red").length;
  const parts = [`${red.length} of ${rows.length} students currently need a check-in (${acad} on academics, ${place} on placement readiness).`];
  const counts = new Map<string, number>();
  for (const r of red) counts.set(r.department, (counts.get(r.department) ?? 0) + 1);
  const top = Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  if (top) parts.push(`${top[0]} has the most students needing a check-in (${top[1]}).`);
  parts.push("Open Response & workload to see who has been contacted and which follow-ups are overdue.");
  return parts.join(" ");
}
