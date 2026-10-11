import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyFilters, bandDistribution, filterOptions, heatmapByDepartment, kpis, quadrantPoints, riskBy,
  type OverviewRow,
} from "./aggregate.ts";

function row(over: Partial<OverviewRow> = {}): OverviewRow {
  return {
    student_id: "1", name: "A", department: "Comp", year: 3, batch: "2023-27", success_score: 70, band: "On Track",
    academic_risk: "Green", placement_risk: "Green", segment: "Steady middle", engagement_drop: false,
    academic: 70, attendance: 80, lms: 70, placement: 72, skills: 60, engagement: 30, feedback: 70, ...over,
  };
}

test("empty input never produces NaN or throws", () => {
  const k = kpis([]);
  assert.equal(k.students, 0);
  assert.equal(k.avgScore, null);
  assert.equal(k.academicRedPct, 0);
  assert.equal(k.placementReadyPct, null);
  assert.deepEqual(bandDistribution([]).map((b) => b.count), [0, 0, 0, 0]);
  assert.deepEqual(riskBy([], "department"), []);
  assert.deepEqual(heatmapByDepartment([]), []);
});

test("kpis count risk and early warnings correctly", () => {
  const rows = [
    row({ success_score: 80, academic_risk: "Red", engagement_drop: true }),
    row({ success_score: 60, placement_risk: "Red" }),
    row({ success_score: 40, placement: null, placement_risk: "Not assessed" }),
  ];
  const k = kpis(rows);
  assert.equal(k.students, 3);
  assert.equal(k.avgScore, 60);
  assert.equal(k.academicRedPct, 33.3);
  assert.equal(k.placementRedPct, 50, "placement % uses only assessed students as the denominator");
  assert.equal(k.earlyWarning, 1);
});

test("placement readiness ignores students with no placement data", () => {
  const rows = [row({ placement: 80 }), row({ placement: 50 }), row({ placement: null, placement_risk: "Not assessed" })];
  assert.equal(kpis(rows).placementReadyPct, 50);
  assert.equal(kpis([row({ placement: null, placement_risk: "Not assessed" })]).placementReadyPct, null);
});

test("filters combine and 'All' means no filter", () => {
  const rows = [row({ department: "Comp", year: 2 }), row({ department: "IT", year: 3 }), row({ department: "IT", year: 4, batch: "2022-26" })];
  assert.equal(applyFilters(rows, { department: "All", year: "All", batch: "All" }).length, 3);
  assert.equal(applyFilters(rows, { department: "IT", year: "All", batch: "All" }).length, 2);
  assert.equal(applyFilters(rows, { department: "IT", year: "4", batch: "2022-26" }).length, 1);
  assert.equal(applyFilters(rows, { department: "ENTC", year: "All", batch: "All" }).length, 0);
});

test("band distribution covers every score and orders worst to best", () => {
  // bands come from the pipeline (single source of truth); the UI only counts them
  const rows = [
    row({ band: "Thriving" }), row({ band: "Thriving" }), row({ band: "On Track" }),
    row({ band: "Needs Attention" }), row({ band: "Critical" }),
  ];
  const d = bandDistribution(rows);
  assert.deepEqual(d.map((b) => b.band), ["Critical", "Needs Attention", "On Track", "Thriving"]);
  assert.deepEqual(d.map((b) => b.count), [1, 1, 1, 2]);
  assert.equal(d.reduce((a, b) => a + b.count, 0), rows.length);
});

test("riskBy groups by department and year with stable ordering", () => {
  const rows = [
    row({ department: "IT", year: 3, academic_risk: "Red" }),
    row({ department: "Comp", year: 2, academic_risk: "Amber" }),
    row({ department: "IT", year: 3, academic_risk: "Green" }),
  ];
  const byDept = riskBy(rows, "department");
  assert.deepEqual(byDept.map((g) => g.group), ["Comp", "IT"]);
  assert.deepEqual(byDept[1], { group: "IT", Red: 1, Amber: 0, Green: 1, total: 2 });
  assert.deepEqual(riskBy(rows, "year").map((g) => g.group), ["Year 2", "Year 3"]);
});

test("quadrant excludes students without placement data", () => {
  const pts = quadrantPoints([row({ student_id: "a" }), row({ student_id: "b", placement: null, placement_risk: "Not assessed" }), row({ student_id: "c", academic: null })]);
  assert.deepEqual(pts.map((p) => p.id), ["a"]);
});

test("heatmap averages ignore missing pillars", () => {
  const rows = [row({ department: "Comp", placement: 80 }), row({ department: "Comp", placement: null }), row({ department: "IT", placement: 40 })];
  const h = heatmapByDepartment(rows);
  assert.equal(h.find((r) => r.department === "Comp")?.placement, 80);
  assert.equal(h.find((r) => r.department === "IT")?.placement, 40);
});

test("filter options are sorted and unique", () => {
  const o = filterOptions([row({ department: "IT", year: 4, batch: "2022-26" }), row({ department: "Comp", year: 2, batch: "2024-28" }), row({ department: "IT", year: 4, batch: "2022-26" })]);
  assert.deepEqual(o.departments, ["Comp", "IT"]);
  assert.deepEqual(o.years, ["2", "4"]);
  assert.deepEqual(o.batches, ["2022-26", "2024-28"]);
});
