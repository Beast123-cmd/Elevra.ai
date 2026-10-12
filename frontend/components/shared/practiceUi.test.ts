import assert from "node:assert/strict";
import test from "node:test";
import { daysSince, hasResults, lastActiveText, quietForAWeek, scoreTone, share, topicsByNeed, weekChange, type TopicStat } from "./practiceUi.ts";

const topic = (category: string, avg: number | null, completed = 1): TopicStat => ({
  category, completed, gave_up: 0, avg_score: avg, completion_rate: null, by_difficulty: {},
});
const TODAY = new Date(2026, 9, 12); // 12 Oct 2026

test("share is a whole-number percentage and never divides by zero", () => {
  assert.equal(share(1, 3), 33);
  assert.equal(share(0, 0), 0);
});

test("topics are ordered lowest average first, with untaken topics last", () => {
  const order = topicsByNeed([topic("coding", 80), topic("cpp", null, 0), topic("sql", 35), topic("mcq", 60)]).map((t) => t.category);
  assert.deepEqual(order, ["sql", "mcq", "coding", "cpp"]);
});

test("hasResults is false until someone has finished a test", () => {
  assert.equal(hasResults([topic("sql", null, 0)]), false);
  assert.equal(hasResults([topic("sql", 50, 2)]), true);
});

test("score tone: under 50 red, under 70 amber, otherwise green", () => {
  assert.deepEqual([49, 50, 69, 70].map(scoreTone), ["red", "amber", "amber", "green"]);
});

test("week change is written in words", () => {
  assert.equal(weekChange(8, 5), "3 more than last week");
  assert.equal(weekChange(2, 6), "4 fewer than last week");
  assert.equal(weekChange(4, 4), "same as last week");
});

test("days since counts calendar days", () => {
  assert.equal(daysSince("2026-10-12", TODAY), 0);
  assert.equal(daysSince("2026-10-05", TODAY), 7);
});

test("last active reads naturally", () => {
  assert.equal(lastActiveText(null, TODAY), "No practice yet");
  assert.equal(lastActiveText("2026-10-12", TODAY), "Today");
  assert.equal(lastActiveText("2026-10-11", TODAY), "Yesterday");
  assert.equal(lastActiveText("2026-10-07", TODAY), "5 days ago");
});

test("quiet for a week: never practised, or seven or more days ago", () => {
  assert.equal(quietForAWeek(null, TODAY), true);
  assert.equal(quietForAWeek("2026-10-05", TODAY), true);
  assert.equal(quietForAWeek("2026-10-06", TODAY), false);
});
