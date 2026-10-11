import assert from "node:assert/strict";
import { test } from "node:test";
import { describeChatError, formatCell } from "./chatUi.ts";

test("formatCell shows missing values as a dash", () => {
  assert.equal(formatCell(null), "—");
  assert.equal(formatCell(undefined), "—");
  assert.equal(formatCell(""), "");
});

test("formatCell rounds long decimals but keeps whole numbers and text", () => {
  assert.equal(formatCell(83.66666), "83.67");
  assert.equal(formatCell(100), "100");
  assert.equal(formatCell(0.5), "0.5");
  assert.equal(formatCell("Comp"), "Comp");
  assert.equal(formatCell(true), "yes");
  assert.equal(formatCell(false), "no");
});

test("an HTTP 422 from the API is a question problem, not an outage", () => {
  assert.equal(describeChatError(new Error("API /chat failed: 422")).kind, "question");
});

test("403 and 401 mean access, not an outage", () => {
  assert.equal(describeChatError(new Error("API /chat failed: 403")).kind, "access");
  assert.equal(describeChatError(new Error("API /chat failed: 401")).kind, "access");
});

test("network failures and server errors are treated as the API being offline", () => {
  assert.equal(describeChatError(new TypeError("Failed to fetch")).kind, "offline");
  assert.equal(describeChatError(new Error("API /chat failed: 502")).kind, "offline");
  assert.equal(describeChatError(new Error("API /chat failed: 500")).kind, "offline");
  assert.equal(describeChatError("weird").kind, "offline");
});

test("every kind has a message a person can act on", () => {
  for (const e of [new Error("API /chat failed: 422"), new Error("API /chat failed: 403"), new TypeError("x")]) {
    assert.ok(describeChatError(e).message.length > 20);
  }
});
