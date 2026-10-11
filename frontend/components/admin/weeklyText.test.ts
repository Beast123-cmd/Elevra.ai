import assert from "node:assert/strict";
import { test } from "node:test";
import { localWeeklyBrief } from "./weeklyText.ts";

const R = (department: string, a: "Red" | "Amber" | "Green", p: "Red" | "Amber" | "Green" | "Not assessed") => ({ department, academic_risk: a, placement_risk: p });

test("counts students who need a check-in once, even when both risks are Red", () => {
  const t = localWeeklyBrief([R("Comp", "Red", "Red"), R("Comp", "Green", "Red"), R("IT", "Green", "Green")]);
  assert.match(t, /^2 of 3 students currently need a check-in \(1 on academics, 2 on placement readiness\)\./);
  assert.match(t, /Comp has the most students needing a check-in \(2\)/);
});

test("with nobody flagged it does not name a department, and an empty list is safe", () => {
  assert.doesNotMatch(localWeeklyBrief([R("Comp", "Green", "Green")]), /has the most/);
  assert.match(localWeeklyBrief([]), /^0 of 0 students/);
});

test("it never predicts failure", () => {
  assert.doesNotMatch(localWeeklyBrief([R("Comp", "Red", "Red")]), /will fail/i);
});
