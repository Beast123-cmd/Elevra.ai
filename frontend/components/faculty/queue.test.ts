import assert from "node:assert/strict";
import { test } from "node:test";
import {
  filterQueue, toCsv, topReasons, type QueueFilters, type QueueRow,
} from "./queue.ts";

const NONE: QueueFilters = { q: "", year: "All", risk: "Any", segment: "All", mentor: "All", hideContacted: false };

function row(over: Partial<QueueRow> = {}): QueueRow {
  return {
    student_id: "40001", name: "Asha Rao", department: "Comp", year: 3, success_score: 55, band: "Needs Attention",
    academic_risk: "Amber", placement_risk: "Green", segment: "Steady middle", priority: 5, engagement_drop: false,
    mentor_faculty_id: "F01", actions: ["Mentor call within 48h"], drivers: { academic: [], placement: [] }, ...over,
  };
}

test("rows are sorted by priority, highest first, without mutating the input", () => {
  const input = [row({ student_id: "a", priority: 2 }), row({ student_id: "b", priority: 9 }), row({ student_id: "c", priority: 5 })];
  const out = filterQueue(input, NONE, new Set());
  assert.deepEqual(out.map((r) => r.student_id), ["b", "c", "a"]);
  assert.deepEqual(input.map((r) => r.student_id), ["a", "b", "c"]);
});

test("search matches name or id, case-insensitively, and ignores surrounding spaces", () => {
  const rows = [row({ student_id: "40001", name: "Asha Rao" }), row({ student_id: "42178", name: "Vikram Iyer" })];
  assert.equal(filterQueue(rows, { ...NONE, q: "  vIkRaM " }, new Set()).length, 1);
  assert.equal(filterQueue(rows, { ...NONE, q: "4000" }, new Set()).length, 1);
  assert.equal(filterQueue(rows, { ...NONE, q: "zzzz" }, new Set()).length, 0);
});

test("risk filters pick the right students", () => {
  const rows = [
    row({ student_id: "a", academic_risk: "Red" }),
    row({ student_id: "b", placement_risk: "Red" }),
    row({ student_id: "c", engagement_drop: true }),
    row({ student_id: "d" }),
  ];
  const ids = (risk: QueueFilters["risk"]) => filterQueue(rows, { ...NONE, risk }, new Set()).map((r) => r.student_id).sort();
  assert.deepEqual(ids("Academic Red"), ["a"]);
  assert.deepEqual(ids("Placement Red"), ["b"]);
  assert.deepEqual(ids("Early warning"), ["c"]);
  assert.deepEqual(ids("Any"), ["a", "b", "c", "d"]);
});

test("year, segment, mentor and hide-contacted combine", () => {
  const rows = [
    row({ student_id: "a", year: 2, mentor_faculty_id: "F01" }),
    row({ student_id: "b", year: 3, segment: "Silent disengagers", mentor_faculty_id: "F02" }),
    row({ student_id: "c", year: 3, segment: "Silent disengagers", mentor_faculty_id: "F02" }),
  ];
  const f = { ...NONE, year: "3", segment: "Silent disengagers", mentor: "F02" };
  assert.equal(filterQueue(rows, f, new Set()).length, 2);
  assert.deepEqual(filterQueue(rows, { ...f, hideContacted: true }, new Set(["b"])).map((r) => r.student_id), ["c"]);
});

test("a mentor with no mentees gives an empty list, not an error", () => {
  assert.deepEqual(filterQueue([], NONE, new Set()), []);
});

test("topReasons merges academic and placement drivers, strongest first", () => {
  const r = row({
    drivers: {
      academic: [{ label: "Attendance below 75% mandate", value: "70%", points: 2 }],
      placement: [{ label: "Coding score below 40", value: "35", points: 3 }, { label: "No hackathons", value: "0", points: 1 }],
    },
  });
  assert.deepEqual(topReasons(r, 2).map((d) => d.label), ["Coding score below 40", "Attendance below 75% mandate"]);
  assert.deepEqual(topReasons(row({ drivers: {} as QueueRow["drivers"] }), 2), []);
});

test("csv quotes commas and quotes, and defuses spreadsheet formulas", () => {
  const csv = toCsv([row({ name: 'Rao, "Asha"', segment: "=HYPERLINK(\"http://x\")", actions: ["A", "B"] })]);
  const [header, line] = csv.split("\n");
  assert.ok(header.startsWith("student_id,name,"));
  assert.ok(line.includes('"Rao, ""Asha"""'));
  assert.ok(line.includes("\"'=HYPERLINK"), "leading = must be neutralised");
  assert.ok(line.includes('"A; B"'));
});

test("csv of nothing is just the header", () => {
  assert.equal(toCsv([]).split("\n").length, 1);
});

test("'Needs contact' picks Red students who were not contacted within the target", () => {
  const rows = [
    row({ student_id: "a", academic_risk: "Red" }),
    row({ student_id: "b", placement_risk: "Red" }),
    row({ student_id: "c", academic_risk: "Red" }),
    row({ student_id: "d" }),
  ];
  const contacted = new Set(["c"]);
  const ids = filterQueue(rows, { ...NONE, risk: "Needs contact" }, contacted).map((r) => r.student_id).sort();
  assert.deepEqual(ids, ["a", "b"]);
});

test("hide-contacted hides students contacted within the target", () => {
  const rows = [row({ student_id: "a" }), row({ student_id: "b" })];
  assert.deepEqual(filterQueue(rows, { ...NONE, hideContacted: true }, new Set(["a"])).map((r) => r.student_id), ["b"]);
});
