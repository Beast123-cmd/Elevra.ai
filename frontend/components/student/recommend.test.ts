import test from "node:test";
import assert from "node:assert/strict";
import { recommend, levelFor } from "./recommend.ts";

const catalog = [
  { title: "Public speaking 101", tag: "Soft", skills: ["placement"] as const, departments: [], trains: ["Public speaking"], level: "Beginner" as const },
  { title: "DP and contests", tag: "Coding", skills: ["placement"] as const, departments: [], trains: ["DSA"], level: "Advanced" as const },
  { title: "VLSI", tag: "VLSI", skills: ["skills"] as const, departments: ["ENTC"], trains: ["VLSI"], level: "Intermediate" as const },
];
const skills = [{ skill: "Public speaking", category: "soft", level: 30 }, { skill: "DSA", category: "technical", level: 88 }];

test("a low skill puts its course in 'Fix a gap' first; a strong skill gets 'Go deeper'", () => {
  const r = recommend(catalog.map((c) => ({ ...c, skills: [...c.skills] })), skills, "Comp");
  assert.equal(r[0].course.title, "Public speaking 101");
  assert.equal(r[0].group, "gap");
  assert.match(r[0].reason, /30\/100/);
  assert.equal(r.find((x) => x.course.title === "DP and contests")?.group, "deeper");
});

test("courses for another department are hidden", () => {
  const r = recommend(catalog.map((c) => ({ ...c, skills: [...c.skills] })), skills, "Comp");
  assert.ok(!r.some((x) => x.course.title === "VLSI"));
});

test("level matches the skill", () => {
  assert.equal(levelFor(30), "Beginner");
  assert.equal(levelFor(60), "Intermediate");
  assert.equal(levelFor(90), "Advanced");
});
