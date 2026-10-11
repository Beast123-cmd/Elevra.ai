import assert from "node:assert/strict";
import { test } from "node:test";
import type { Profile } from "../../lib/types.ts";
import { localBrief } from "./briefTemplate.ts";

const BASE = {
  student_id: "41412", name: "Diya Kumar", department: "Comp", year: 4, batch: "2024-2027", score: 50.1, band: "Needs Attention",
  confidence: 100, segment: "Silent disengagers", engagement_drop: true, declining: true,
  academic_risk: { level: "Red", points: 9, drivers: [
    { label: "Attendance below detention line (65%)", value: "47.5%", points: 4 }, { label: "Active backlogs", value: "1", points: 2 },
    { label: "Assignment submission below 60%", value: "50%", points: 1 }] },
  placement_risk: { level: "Red", points: 6, drivers: [{ label: "Coding score below 40", value: "30", points: 2 }] },
  actions: ["Attendance counselling and a check-in", "Mentor check-in within 48 hours"],
} as unknown as Profile;

test("mentions the key facts and keeps the support framing", () => {
  const t = localBrief(BASE);
  for (const needle of ["Diya Kumar", "50.1", "Needs Attention", "Red", "47.5%", "Attendance counselling"]) assert.ok(t.includes(needle), needle);
  assert.ok(t.includes("conversation"));
  assert.ok(!/will fail/i.test(t));
});

test("a student with no placement data is described as not yet assessed", () => {
  const t = localBrief({ ...BASE, year: 2, placement_risk: { level: "Not assessed", points: 0, drivers: [] } } as Profile);
  assert.ok(/not yet assessed/i.test(t));
});

test("never prints undefined, null or NaN, even with sparse data", () => {
  const sparse = { ...BASE, actions: undefined, engagement_drop: undefined, declining: undefined, confidence: undefined,
    academic_risk: { level: "Amber", points: 3, drivers: [] }, placement_risk: { level: "Green", points: 0, drivers: [] } } as unknown as Profile;
  const t = localBrief(sparse);
  for (const bad of ["undefined", "null", "NaN"]) assert.ok(!t.includes(bad), bad);
});

test("a healthy student gets a calm brief", () => {
  const t = localBrief({ ...BASE, band: "Thriving", score: 82, engagement_drop: false, declining: false, actions: [],
    academic_risk: { level: "Green", points: 0, drivers: [] }, placement_risk: { level: "Green", points: 0, drivers: [] } } as Profile);
  assert.ok(/on track/i.test(t));
  assert.ok(!/Suggested next steps/.test(t));
});

test("uses the name, never gendered pronouns", () => {
  assert.ok(!/\b(he|she|his|her|him)\b/i.test(localBrief(BASE)));
});
