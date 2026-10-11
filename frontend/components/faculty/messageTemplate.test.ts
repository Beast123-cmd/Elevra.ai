import assert from "node:assert/strict";
import { test } from "node:test";
import { localMessage, mailtoUrl, MESSAGE_KINDS, whatsappUrl } from "./messageTemplate.ts";

const P = { name: "Diya Kumar", actions: ["Mentor check-in within 48 hours", "Schedule a mock interview"] };

test("every kind produces a draft that names the student and never shows a risk colour or score", () => {
  for (const [kind] of MESSAGE_KINDS) {
    const m = localMessage(kind, P);
    assert.match(m, /Diya Kumar/);
    assert.doesNotMatch(m, /\b(red|amber)\b|success score|will fail/i);
    assert.doesNotMatch(m, /\b(he|she|his|her|him)\b/i);
  }
});

test("the guardian note has no numbers, so it cannot disclose a score", () => {
  assert.doesNotMatch(localMessage("guardian_attendance", P), /\d/);
});

test("the placement nudge picks a placement-related action, not a generic mentor one", () => {
  assert.match(localMessage("placement_nudge", P), /schedule a mock interview/);
  assert.doesNotMatch(localMessage("placement_nudge", { name: "A", actions: ["Mentor check-in within 48 hours"] }), /48 hours/);
});

test("share links encode the text safely", () => {
  assert.equal(whatsappUrl("a b&c"), "https://wa.me/?text=a%20b%26c");
  assert.equal(mailtoUrl("Hi there", "x&y"), "mailto:?subject=Hi%20there&body=x%26y");
});
