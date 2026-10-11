import assert from "node:assert/strict";
import { test } from "node:test";
import { buildAudience, describeAudience, matchesAudience } from "./audience.ts";

const S = { student_id: "42178", department: "Comp", year: 3 };

test("buildAudience produces the stored string format", () => {
  assert.deepEqual(buildAudience("all", ""), { ok: true, value: "all" });
  assert.deepEqual(buildAudience("dept", "Comp"), { ok: true, value: "dept:Comp" });
  assert.deepEqual(buildAudience("year", "4"), { ok: true, value: "year:4" });
  assert.deepEqual(buildAudience("student", " 42178 "), { ok: true, value: "student:42178" });
});

test("buildAudience rejects missing or malformed targets", () => {
  for (const [kind, v] of [["dept", ""], ["year", "5"], ["year", "abc"], ["student", ""], ["student", "42 178"], ["team", "x"]] as const) {
    assert.equal(buildAudience(kind, v).ok, false, `${kind}:${v}`);
  }
});

test("a student sees the notifications addressed to them", () => {
  assert.equal(matchesAudience("all", S), true);
  assert.equal(matchesAudience("dept:Comp", S), true);
  assert.equal(matchesAudience("dept:IT", S), false);
  assert.equal(matchesAudience("year:3", S), true);
  assert.equal(matchesAudience("year:2", S), false);
  assert.equal(matchesAudience("student:42178", S), true);
  assert.equal(matchesAudience("student:99999", S), false);
});

test("unknown or corrupt audience strings match nobody", () => {
  for (const a of ["", "dept:", "year:x", "nonsense", "student:", "ALL"]) assert.equal(matchesAudience(a, S), false, a);
});

test("department names with special characters survive the round trip", () => {
  const built = buildAudience("dept", "AI&DS");
  assert.equal(built.ok && matchesAudience(built.value, { ...S, department: "AI&DS" }), true);
});

test("describeAudience gives a readable label", () => {
  assert.equal(describeAudience("all"), "Everyone");
  assert.equal(describeAudience("dept:Comp"), "Department: Comp");
  assert.equal(describeAudience("year:4"), "Year 4");
  assert.equal(describeAudience("student:42178"), "Student 42178");
  assert.equal(describeAudience("???"), "Unknown audience");
});
