import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { canViewStudent, INTERVENTION_TYPES, validateIntervention } from "./interventions.ts";

const TODAY = new Date("2026-10-11T10:00:00");
const ok = { type: "Mentoring call", note: "Called the student", followup_date: "2026-10-20" };

test("types stay in sync with the database check constraint", () => {
  const sql = readFileSync(new URL("../../../db/migrations/001_init.sql", import.meta.url), "utf-8");
  const block = sql.slice(sql.indexOf("create table if not exists interventions"));
  const listed = Array.from(block.slice(block.indexOf("check (type in"), block.indexOf("status")).matchAll(/'([^']+)'/g)).map((m) => m[1]);
  assert.deepEqual([...INTERVENTION_TYPES].sort(), listed.sort());
});

test("a complete intervention is valid", () => {
  assert.deepEqual(validateIntervention(ok, TODAY), {});
});

test("type is required and must be a known type", () => {
  assert.ok(validateIntervention({ ...ok, type: "" }, TODAY).type);
  assert.ok(validateIntervention({ ...ok, type: "Pizza party" }, TODAY).type);
});

test("note and follow-up date are optional", () => {
  assert.deepEqual(validateIntervention({ type: "Remedial classes", note: "", followup_date: "" }, TODAY), {});
});

test("overlong notes are rejected", () => {
  assert.ok(validateIntervention({ ...ok, note: "x".repeat(501) }, TODAY).note);
  assert.deepEqual(validateIntervention({ ...ok, note: "x".repeat(500) }, TODAY), {});
});

test("follow-up date must be a real date that is not in the past", () => {
  assert.ok(validateIntervention({ ...ok, followup_date: "2026-10-10" }, TODAY).followup_date);
  assert.ok(validateIntervention({ ...ok, followup_date: "not-a-date" }, TODAY).followup_date);
  assert.ok(validateIntervention({ ...ok, followup_date: "2026-02-30" }, TODAY).followup_date, "impossible calendar date");
  assert.deepEqual(validateIntervention({ ...ok, followup_date: "2026-10-11" }, TODAY), {}, "today is allowed");
});

test("faculty may open only their own mentees; admins may open anyone", () => {
  assert.equal(canViewStudent({ role: "admin", facultyId: null }, "F01"), true);
  assert.equal(canViewStudent({ role: "faculty", facultyId: "F01" }, "F01"), true);
  assert.equal(canViewStudent({ role: "faculty", facultyId: "F01" }, "F02"), false);
  assert.equal(canViewStudent({ role: "faculty", facultyId: null }, "F01"), false);
  assert.equal(canViewStudent({ role: "student", facultyId: null }, "F01"), false);
});
