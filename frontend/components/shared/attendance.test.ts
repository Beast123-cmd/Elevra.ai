import assert from "node:assert/strict";
import { test } from "node:test";
import { csvCell, DEFAULT_POLICY, describe, plan, recovery, summarize, toCsv } from "./attendance.ts";

// 16 weeks x 15 classes = 240 classes in the term. Halfway (8 weeks) = 120 held, 120 remaining.
test("a student comfortably above the threshold is Safe and told how many classes they can miss", () => {
  const r = recovery(90, 8);
  assert.equal(r.status, "Safe");
  assert.equal(r.held, 120);
  assert.equal(r.remaining, 120);
  // attended 108; need 180 of 240; can miss 108+120-180 = 48
  assert.equal(r.canMiss, 48);
});

test("below the threshold but reachable is Recoverable, with the exact number of classes needed", () => {
  const r = recovery(60, 8); // attended 72, need 180 -> 108 of 120
  assert.equal(r.status, "Recoverable");
  assert.equal(r.needed, 108);
  assert.equal(r.remaining, 120);
});

test("when the threshold is out of reach but the condonation range is not, it says Needs condonation", () => {
  const r = recovery(50, 8); // attended 60; 75% needs 120 of 120 remaining = just reachable
  assert.equal(r.status, "Recoverable");
  const r2 = recovery(45, 8); // attended 54; 75% needs 126 > 120; 65% (156) needs 102 <= 120
  assert.equal(r2.status, "Needs condonation");
  assert.equal(r2.needed, 102);
});

test("when even full attendance does not reach the condonation range, it is Cannot recover", () => {
  const r = recovery(30, 12); // 180 held, attended 54, remaining 60; 65% = 156 needs 102 > 60
  assert.equal(r.status, "Cannot recover");
});

test("condonation of 0 disables that status", () => {
  assert.equal(recovery(45, 8, { ...DEFAULT_POLICY, condonation: 0 }).status, "Cannot recover");
});

test("the exact boundary counts as Safe, one class under does not", () => {
  assert.equal(recovery(75, 8).status, "Safe");
  assert.equal(recovery(75, 8).canMiss, 30); // attended 90 + 120 remaining - 180 needed
  assert.equal(recovery(74.9, 16).status, "Needs condonation");
});

test("missing, impossible or non-finite data is No data rather than a wrong answer", () => {
  assert.equal(recovery(null, 8).status, "No data");
  assert.equal(recovery(undefined, 8).status, "No data");
  assert.equal(recovery(NaN, 8).status, "No data");
  assert.equal(recovery(130, 8).status, "No data");
  assert.equal(recovery(-5, 8).status, "No data");
});

test("term start and term end are handled", () => {
  const start = recovery(0, 0);
  assert.equal(start.held, 0);
  assert.equal(start.status, "Recoverable"); // 0 of 0 held, 180 of 240 needed
  const end = recovery(80, 16);
  assert.equal(end.remaining, 0);
  assert.equal(end.status, "Safe");
  assert.equal(recovery(70, 16).status, "Needs condonation"); // nothing left to attend, within 10 points
  assert.equal(recovery(60, 16).status, "Cannot recover");
});

test("weeks done past the term length is clamped", () => {
  assert.equal(recovery(80, 40).held, 240);
  assert.equal(recovery(80, 40).remaining, 0);
});

test("projected percentage at term end follows the current rate", () => {
  assert.equal(recovery(60, 8).projectedIfNoChange, 60);
  assert.equal(recovery(80, 0).projectedIfNoChange, 80);
});

test("the policy is editable: a stricter threshold changes the result", () => {
  assert.equal(recovery(78, 8).status, "Safe");
  assert.equal(recovery(78, 8, { ...DEFAULT_POLICY, threshold: 85 }).status, "Recoverable");
});

test("plan puts the least-room students first and summarize counts every status", () => {
  const rows = [
    { student_id: "S3", name: "C", department: "CSE", year: 2, mentor_faculty_id: "F1", pct: 90 },
    { student_id: "S1", name: "A", department: "CSE", year: 2, mentor_faculty_id: "F1", pct: 30 },
    { student_id: "S2", name: "B", department: "CSE", year: 2, mentor_faculty_id: "F1", pct: 60 },
    { student_id: "S4", name: "D", department: "CSE", year: 2, mentor_faculty_id: null, pct: null },
  ];
  const p = plan(rows, 12);
  assert.deepEqual(p.map((x) => x.student_id), ["S1", "S2", "S3", "S4"]);
  const s = summarize(p);
  assert.equal(s["Cannot recover"], 1);
  assert.equal(s.Safe, 1);
  assert.equal(s["No data"], 1);
  assert.equal(Object.values(s).reduce((a, b) => a + b, 0), 4);
});

test("csv cells are quoted and spreadsheet formulas are neutralised", () => {
  assert.equal(csvCell("a,b"), '"a,b"');
  assert.equal(csvCell('say "hi"'), '"say ""hi"""');
  assert.equal(csvCell("=HYPERLINK(\"x\")"), '"\'=HYPERLINK(""x"")"');
  assert.equal(csvCell("+1"), "'+1");
  assert.equal(csvCell(null), "");
  assert.equal(csvCell(0), "0");
});

test("csv has a header and one line per student", () => {
  const rows = plan([{ student_id: "S1", name: "=cmd", department: "CSE", year: 1, mentor_faculty_id: "F1", pct: 50 }], 8);
  const lines = toCsv(rows).split("\n");
  assert.equal(lines.length, 2);
  assert.match(lines[1], /'=cmd/);
});

test("wording is supportive and never predicts failure", () => {
  for (const pct of [90, 60, 45, 30]) {
    const text = describe(recovery(pct, pct === 30 ? 12 : 8));
    assert.doesNotMatch(text, /will fail|detain|doomed/i);
  }
  assert.match(describe(recovery(60, 8)), /Needs a check-in/);
});
