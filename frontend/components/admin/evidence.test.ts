import assert from "node:assert/strict";
import { test } from "node:test";
import { byDepartment, classify, DEFAULT_THRESHOLDS, learnersCsv, mentorAllocation, slowLearnerSupport, supportCsv, supportSummary, type Learner, type SupportRow } from "./evidence.ts";

const L = (id: string, dept: string, academic: number | null, mentor: string | null = "F1"): Learner => ({
  student_id: id, name: `S${id}`, department: dept, year: 2, mentor_faculty_id: mentor, academic, success_score: 60,
});

test("classification uses the editable thresholds, and the boundaries belong to Average", () => {
  assert.equal(classify(49.9), "Slow");
  assert.equal(classify(50), "Average");
  assert.equal(classify(75), "Average");
  assert.equal(classify(75.1), "Advanced");
  assert.equal(classify(null), "Not assessed");
  assert.equal(classify(NaN), "Not assessed");
  assert.equal(classify(60, { slowBelow: 65, advancedAbove: 90 }), "Slow");
});

test("department table counts every student exactly once and percentages ignore unassessed students", () => {
  const rows = [L("1", "Comp", 40), L("2", "Comp", 60), L("3", "Comp", 80), L("4", "Comp", null), L("5", "IT", 30)];
  const { depts, all } = byDepartment(rows);
  assert.deepEqual(depts.map((d) => d.department), ["Comp", "IT"]);
  const comp = depts[0];
  assert.equal(comp.total, 4);
  assert.equal(comp.slow + comp.average + comp.advanced + comp.notAssessed, comp.total);
  assert.equal(comp.slowPct, 33.3); // 1 of the 3 assessed
  assert.equal(all.total, 5);
  assert.equal(all.slow, 2);
});

test("empty input gives zeros, not NaN", () => {
  const { depts, all } = byDepartment([]);
  assert.equal(depts.length, 0);
  assert.equal(all.slowPct, 0);
});

test("mentor allocation lists every faculty including those with no mentees, plus unassigned students", () => {
  const rows = [L("1", "Comp", 50, "F1"), L("2", "Comp", 50, "F1"), L("3", "IT", 50, null)];
  const out = mentorAllocation(rows, [{ faculty_id: "F1", name: "A", department: "Comp" }, { faculty_id: "F2", name: "B", department: "IT" }]);
  assert.deepEqual(out.map((m) => [m.mentor, m.mentees]), [["F1", 2], ["-", 1], ["F2", 0]]);
});

const S = (id: number, student: string, seeded: boolean, type = "Mentoring call", status = "done"): SupportRow =>
  ({ id, student_id: student, faculty_id: "F1", type, status, created_at: "2026-10-11T10:00:00Z", is_seeded: seeded });

test("support evidence counts only live records and says how many demonstration records exist", () => {
  const s = supportSummary([S(1, "1", false), S(2, "1", false, "Remedial classes"), S(3, "2", true), S(4, "3", false, "Mentoring call", "planned")]);
  assert.equal(s.live, 3);
  assert.equal(s.seeded, 1);
  assert.equal(s.students, 2);
  assert.equal(s.done, 2);
  assert.deepEqual(s.byType[0], ["Mentoring call", 2]);
});

test("slow-learner support ignores seeded history", () => {
  const rows = [L("1", "Comp", 30), L("2", "Comp", 40), L("3", "Comp", 90)];
  const r = slowLearnerSupport(rows, [S(1, "1", false), S(2, "2", true), S(3, "3", false)]);
  assert.deepEqual(r, { slow: 2, withSupport: 1, pct: 50 });
});

test("csv exports neutralise formulas and the support export leaves out demonstration records", () => {
  const csv = learnersCsv([{ ...L("1", "Comp", 30), name: "=1+1" }]);
  assert.match(csv.split("\n")[1], /'=1\+1/);
  const lines = supportCsv([S(1, "1", false), S(2, "2", true)]).split("\n");
  assert.equal(lines.length, 2);
});

test("defaults match the documented NAAC-style cut-offs", () => {
  assert.deepEqual(DEFAULT_THRESHOLDS, { slowBelow: 50, advancedAbove: 75 });
});
