import assert from "node:assert/strict";
import { test } from "node:test";
import { describeApiError, isNetworkError, serverReason } from "./apiErrors.ts";

test("a browser network failure is recognised, and a server answer is not", () => {
  assert.equal(isNetworkError(new TypeError("Failed to fetch")), true);
  assert.equal(isNetworkError(new Error("Load failed")), true);
  assert.equal(isNetworkError(new Error("API /admin/users failed: 409 - Email already exists")), false);
});

test("the server's own reason is surfaced", () => {
  const e = new Error("API /admin/users failed: 409 - A login with this email already exists");
  assert.equal(serverReason(e), "A login with this email already exists");
  assert.match(describeApiError(e, "Creating the account"), /A login with this email already exists/);
});

test("an unreachable server is explained as such, not as a form problem", () => {
  const msg = describeApiError(new TypeError("Failed to fetch"), "Creating the account");
  assert.match(msg, /server, which is not reachable/);
  assert.doesNotMatch(msg, /check the details/i);
});

test("permission errors and unknown errors get plain wording", () => {
  assert.match(describeApiError(new Error("API /x failed: 403"), "Changing the mentor"), /refused/);
  assert.equal(describeApiError("weird", "Saving"), "Saving failed. Please try again.");
});
