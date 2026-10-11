import assert from "node:assert/strict";
import { test } from "node:test";
import {
  contactState, coverage, followUps, isRed, mentorLoads, needsContact, SLA_DAYS, suggestRebalance,
  type CaseRow, type StudentRow,
} from "./cases.ts";

const NOW = new Date("2026-10-11T12:00:00");
const day = (n: number) => new Date(NOW.getTime() - n * 86400000).toISOString();

function stu(over: Partial<StudentRow> = {}): StudentRow {
  return {
    student_id: "1", name: "A", department: "Comp", year: 3, mentor_faculty_id: "F01", academic_risk: "Red",
    placement_risk: "Green", priority: 10, ...over,
  };
}
function cse(over: Partial<CaseRow> = {}): CaseRow {
  return { id: 1, student_id: "1", type: "Mentoring call", status: "done", followup_date: null, created_at: day(1), is_seeded: false, ...over };
}

test("a student is Red if either risk is Red", () => {
  assert.equal(isRed(stu({ academic_risk: "Red", placement_risk: "Green" })), true);
  assert.equal(isRed(stu({ academic_risk: "Green", placement_risk: "Red" })), true);
  assert.equal(isRed(stu({ academic_risk: "Amber", placement_risk: "Not assessed" })), false);
});

test("never contacted when there are no live interventions", () => {
  assert.deepEqual(contactState("1", [], NOW), { kind: "never" });
});

test("seeded historical interventions do not count as contact", () => {
  assert.deepEqual(contactState("1", [cse({ is_seeded: true, created_at: day(0) })], NOW), { kind: "never" });
});

test("a planned task is not contact yet; an in-progress or done one is", () => {
  assert.deepEqual(contactState("1", [cse({ status: "planned" })], NOW), { kind: "never" });
  assert.deepEqual(contactState("1", [cse({ status: "in_progress", created_at: day(2) })], NOW), { kind: "ok", daysAgo: 2 });
  assert.deepEqual(contactState("1", [cse({ status: "done", created_at: day(0) })], NOW), { kind: "ok", daysAgo: 0 });
});

test("the most recent contact decides, and the response target is inclusive", () => {
  const cases = [cse({ id: 1, created_at: day(20) }), cse({ id: 2, created_at: day(SLA_DAYS) })];
  assert.deepEqual(contactState("1", cases, NOW), { kind: "ok", daysAgo: SLA_DAYS });
  assert.deepEqual(contactState("1", [cse({ created_at: day(SLA_DAYS + 1) })], NOW), { kind: "stale", daysAgo: SLA_DAYS + 1 });
});

test("only the student's own cases are considered", () => {
  assert.deepEqual(contactState("1", [cse({ student_id: "2" })], NOW), { kind: "never" });
});

test("needsContact lists Red students past the response target, highest priority first, and honours the cap", () => {
  const rows = [
    stu({ student_id: "a", priority: 5 }), stu({ student_id: "b", priority: 9 }), stu({ student_id: "c", priority: 7 }),
    stu({ student_id: "d", priority: 20, academic_risk: "Green", placement_risk: "Green" }),
    stu({ student_id: "e", priority: 8 }),
  ];
  const cases = [cse({ student_id: "e", created_at: day(1) })];
  assert.deepEqual(needsContact(rows, cases, NOW).map((r) => r.student_id), ["b", "c", "a"]);
  assert.deepEqual(needsContact(rows, cases, NOW, 2).map((r) => r.student_id), ["b", "c"]);
  assert.deepEqual(needsContact([], [], NOW), []);
});

test("follow-ups split into overdue, due today and upcoming; done tasks and undated tasks are separate", () => {
  const cases = [
    cse({ id: 1, status: "planned", followup_date: "2026-10-09" }),
    cse({ id: 2, status: "in_progress", followup_date: "2026-10-11" }),
    cse({ id: 3, status: "planned", followup_date: "2026-10-14" }),
    cse({ id: 4, status: "planned", followup_date: "2026-10-30" }),
    cse({ id: 5, status: "done", followup_date: "2026-10-01" }),
    cse({ id: 6, status: "planned", followup_date: null }),
  ];
  const f = followUps(cases, NOW);
  assert.deepEqual(f.overdue.map((c) => c.id), [1]);
  assert.deepEqual(f.today.map((c) => c.id), [2]);
  assert.deepEqual(f.upcoming.map((c) => c.id), [3]);
  assert.deepEqual(f.undated.map((c) => c.id), [6]);
});

test("overdue follow-ups are listed oldest first", () => {
  const cases = [cse({ id: 1, status: "planned", followup_date: "2026-10-10" }), cse({ id: 2, status: "planned", followup_date: "2026-10-01" })];
  assert.deepEqual(followUps(cases, NOW).overdue.map((c) => c.id), [2, 1]);
});

test("coverage counts Red students contacted within the target, and never zero-divides", () => {
  const rows = [stu({ student_id: "a" }), stu({ student_id: "b" }), stu({ student_id: "c" }), stu({ student_id: "g", academic_risk: "Green" })];
  const cases = [cse({ student_id: "a", created_at: day(1) }), cse({ student_id: "b", created_at: day(30) }), cse({ id: 9, student_id: "c", status: "planned", followup_date: "2026-10-01" })];
  const c = coverage(rows, cases, NOW);
  assert.deepEqual({ red: c.red, contacted: c.contacted, never: c.never, stale: c.stale, overdue: c.overdueFollowUps }, { red: 3, contacted: 1, never: 1, stale: 1, overdue: 1 });
  assert.equal(c.pct, 33.3);
  assert.equal(coverage([], [], NOW).pct, 0);
});

test("mentor loads show Red count, uncontacted Red and overdue follow-ups per mentor", () => {
  const rows = [
    stu({ student_id: "a", mentor_faculty_id: "F01" }), stu({ student_id: "b", mentor_faculty_id: "F01" }),
    stu({ student_id: "c", mentor_faculty_id: "F02", academic_risk: "Green" }),
  ];
  const cases = [cse({ student_id: "a", created_at: day(2) }), cse({ id: 2, student_id: "b", status: "planned", followup_date: "2026-10-01" })];
  const loads = mentorLoads(rows, cases, NOW);
  const f01 = loads.find((l) => l.mentor === "F01")!;
  assert.deepEqual({ mentees: f01.mentees, red: f01.red, uncontacted: f01.uncontacted, overdue: f01.overdue }, { mentees: 2, red: 2, uncontacted: 1, overdue: 1 });
  assert.equal(loads.find((l) => l.mentor === "F02")!.red, 0);
  assert.equal(loads[0].mentor, "F01", "busiest mentor first");
});

test("rebalancing moves untouched Red students from an overloaded mentor to a lighter one in the same department only", () => {
  const rows = [
    ...["a", "b", "c", "d", "e", "f"].map((id, i) => stu({ student_id: id, mentor_faculty_id: "F01", priority: i })),
    stu({ student_id: "x", mentor_faculty_id: "F02", academic_risk: "Green" }),
    stu({ student_id: "y", mentor_faculty_id: "F03", department: "IT", academic_risk: "Green" }),
  ];
  const mentors = [{ faculty_id: "F01", department: "Comp" }, { faculty_id: "F02", department: "Comp" }, { faculty_id: "F03", department: "IT" }];
  const moves = suggestRebalance(rows, [], mentors, NOW);
  assert.ok(moves.length > 0 && moves.length <= 3);
  for (const m of moves) {
    assert.equal(m.from, "F01");
    assert.equal(m.to, "F02", "the IT mentor must not receive a Comp student");
  }
  assert.equal(new Set(moves.map((m) => m.student_id)).size, moves.length, "no student is moved twice");
});

test("rebalancing leaves students alone when a mentor is already working with them", () => {
  const rows = ["a", "b", "c", "d", "e", "f"].map((id) => stu({ student_id: id, mentor_faculty_id: "F01" })).concat([stu({ student_id: "x", mentor_faculty_id: "F02", academic_risk: "Green" })]);
  const mentors = [{ faculty_id: "F01", department: "Comp" }, { faculty_id: "F02", department: "Comp" }];
  const cases = rows.filter((r) => r.mentor_faculty_id === "F01").map((r, i) => cse({ id: i + 1, student_id: r.student_id, created_at: day(1) }));
  assert.deepEqual(suggestRebalance(rows, cases, mentors, NOW), []);
});

test("an evenly loaded team needs no rebalancing", () => {
  const rows = [stu({ student_id: "a", mentor_faculty_id: "F01" }), stu({ student_id: "b", mentor_faculty_id: "F02" })];
  const mentors = [{ faculty_id: "F01", department: "Comp" }, { faculty_id: "F02", department: "Comp" }];
  assert.deepEqual(suggestRebalance(rows, [], mentors, NOW), []);
});
