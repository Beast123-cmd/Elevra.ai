import assert from "node:assert/strict";
import { test } from "node:test";
import { studentFilter } from "./search.ts";

test("a number searches by id prefix, text searches names anywhere", () => {
  assert.equal(studentFilter("409"), "student_id.like.409*");
  assert.equal(studentFilter("meera"), "name.ilike.*meera*");
  assert.equal(studentFilter("  Meera   Singh "), "name.ilike.*Meera Singh*");
});

test("too short or empty input does not query", () => {
  assert.equal(studentFilter(""), null);
  assert.equal(studentFilter("a"), null);
  assert.equal(studentFilter(" , "), null);
});

test("characters that could change the PostgREST expression are removed", () => {
  const f = studentFilter("x),role.eq.admin,(name.ilike.%")!;
  assert.doesNotMatch(f.slice("name.ilike.".length), /[,()%]/);
  assert.equal(studentFilter("40%"), "student_id.like.40*");
  assert.ok(studentFilter("a".repeat(100))!.length < 60);
});
