import assert from "node:assert/strict";
import { test } from "node:test";
import { effectiveness } from "./effectiveness.ts";

test("averages the score change per intervention type, best first", () => {
  const out = effectiveness([
    { type: "Mentoring call", score_before: 50, score_after: 58 },
    { type: "Mentoring call", score_before: 40, score_after: 44 },
    { type: "Coding bootcamp", score_before: 60, score_after: 71 },
    { type: "Attendance counselling", score_before: 55, score_after: 54 },
  ]);
  assert.deepEqual(out.rows.map((r) => r.type), ["Coding bootcamp", "Mentoring call", "Attendance counselling"]);
  assert.equal(out.rows[1].avgChange, 6);
  assert.equal(out.rows[1].n, 2);
});

test("improvedPct is the share of students whose score went up", () => {
  const out = effectiveness([
    { type: "Remedial classes", score_before: 40, score_after: 50 },
    { type: "Remedial classes", score_before: 40, score_after: 40 },
    { type: "Remedial classes", score_before: 40, score_after: 35 },
    { type: "Remedial classes", score_before: 40, score_after: 46 },
  ]);
  assert.equal(out.rows[0].improvedPct, 50);
});

test("interventions without an outcome are counted as pending, not as zero change", () => {
  const out = effectiveness([
    { type: "Mentoring call", score_before: 50, score_after: null },
    { type: "Mentoring call", score_before: null, score_after: 60 },
    { type: "Mentoring call", score_before: 50, score_after: 56 },
  ]);
  assert.equal(out.pending, 2);
  assert.equal(out.rows[0].n, 1);
  assert.equal(out.rows[0].avgChange, 6);
});

test("a type with only pending rows does not appear in the chart", () => {
  const out = effectiveness([{ type: "Wellbeing referral", score_before: 50, score_after: null }]);
  assert.deepEqual(out.rows, []);
  assert.equal(out.pending, 1);
});

test("no rows at all is safe", () => {
  assert.deepEqual(effectiveness([]), { rows: [], pending: 0, total: 0 });
});

test("decimal scores from the database (numeric strings) are handled", () => {
  const out = effectiveness([{ type: "Mock interviews", score_before: "52.5" as unknown as number, score_after: "58.0" as unknown as number }]);
  assert.equal(out.rows[0].avgChange, 5.5);
});
